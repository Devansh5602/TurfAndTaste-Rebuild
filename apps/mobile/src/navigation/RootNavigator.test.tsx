import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { ThemeProvider } from '@turf-and-taste/ui-native';
import { AuthProvider } from '../context/AuthContext';
import { RootNavigator } from './RootNavigator';
import { readPendingVerificationEmail, supabase } from '../auth/supabase';
import { MOBILE_AUTH_CALLBACK_URL } from '../auth/authCallback';

jest.mock('../auth/supabase', () => {
  const auth = {
    getSession: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    resend: jest.fn(),
    refreshSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    setSession: jest.fn(),
    exchangeCodeForSession: jest.fn(),
  };
  return {
    supabase: { auth },
    readPendingVerificationEmail: jest.fn(),
    storePendingVerificationEmail: jest.fn(),
    clearPendingVerificationEmail: jest.fn(),
  };
});

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Customer screens are stubbed: this suite exercises auth state → route
// guard → navigation, not each customer screen's data fetching.
jest.mock('../screens/customer/HomeScreen', () => {
  const { createInteropElement } = jest.requireActual('react-native-css-interop');
  const { Text } = jest.requireActual('react-native');
  return {
    HomeScreen: () => createInteropElement(Text, { testID: 'home-screen' }, 'Customer Home'),
  };
});
jest.mock('../screens/customer/FacilitiesScreen', () => ({
  FacilitiesScreen: () => null,
}));
jest.mock('../screens/customer/FacilityDetailScreen', () => ({
  FacilityDetailScreen: () => null,
}));
jest.mock('../screens/customer/BookingScreen', () => ({ BookingScreen: () => null }));
jest.mock('../screens/customer/MyBookingsScreen', () => ({ MyBookingsScreen: () => null }));
jest.mock('../screens/customer/BookingDetailScreen', () => ({ BookingDetailScreen: () => null }));
jest.mock('../screens/customer/PaymentScreen', () => ({ PaymentScreen: () => null }));
jest.mock('../screens/customer/ProfileScreen', () => ({ ProfileScreen: () => null }));

jest.mock('react-native-safe-area-context', () => {
  // Official mock: provides real SafeAreaInsetsContext/SafeAreaFrameContext
  // objects (required by @react-navigation) with default metrics.
  const mock = jest.requireActual('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

interface AuthMock {
  getSession: jest.Mock;
  signInWithPassword: jest.Mock;
  signUp: jest.Mock;
  signOut: jest.Mock;
  resetPasswordForEmail: jest.Mock;
  resend: jest.Mock;
  refreshSession: jest.Mock;
  onAuthStateChange: jest.Mock;
  setSession: jest.Mock;
  exchangeCodeForSession: jest.Mock;
}
const auth = supabase.auth as unknown as AuthMock;
const pendingRead = readPendingVerificationEmail as jest.Mock;
const linking = Linking as unknown as { getInitialURL: jest.Mock; addEventListener: jest.Mock };

const user = { id: 'user-1', email: 'person@example.com' } as User;
const session = {
  access_token: 'access-token-value',
  refresh_token: 'refresh-token-value',
  expires_at: 9_999_999_999,
  token_type: 'bearer',
  user,
} as unknown as Session;

const themeStorage = {
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
};

let authCallback: ((event: string, session: Session | null) => void) | null = null;
const unsubscribe = jest.fn();

function authError(message: string, code?: string): Error {
  const error = new Error(message);
  error.name = 'AuthApiError';
  if (code !== undefined) {
    (error as Error & { code?: string }).code = code;
  }
  return error;
}

type InitialRoute = 'SignIn' | 'CreateAccount';

function renderApp(initialRoute?: InitialRoute) {
  return render(
    <ThemeProvider storage={themeStorage}>
      <NavigationContainer
        initialState={initialRoute ? { index: 0, routes: [{ name: initialRoute }] } : undefined}
      >
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

/** Topmost wins: screens lower in the navigation stack stay mounted. */
function pressTopmost(label: string) {
  const matches = screen.getAllByLabelText(label);
  fireEvent.press(matches[matches.length - 1]!);
}

async function fillAndSubmitSignIn(email: string, password: string) {
  fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), email);
  fireEvent.changeText(screen.getByPlaceholderText('••••••••'), password);
  pressTopmost('Sign in');
}

async function fillAndSubmitCreateAccount(email: string, password: string) {
  fireEvent.changeText(screen.getByPlaceholderText('John Doe'), 'Test Person');
  fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), email);
  const passwords = screen.getAllByPlaceholderText('••••••••');
  fireEvent.changeText(passwords[0]!, password);
  fireEvent.changeText(passwords[1]!, password);
  pressTopmost('Create account');
}

describe('RootNavigator auth routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authCallback = null;
    unsubscribe.mockClear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    themeStorage.getItem.mockResolvedValue(null);
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.onAuthStateChange.mockImplementation((callback: unknown) => {
      authCallback = callback as (event: string, session: Session | null) => void;
      return { data: { subscription: { unsubscribe } } };
    });
    linking.getInitialURL.mockResolvedValue(null);
    linking.addEventListener.mockImplementation(() => ({ remove: jest.fn() }));
    pendingRead.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks redirect decisions until session hydration completes', async () => {
    let resolveSession!: (value: { data: { session: null }; error: null }) => void;
    auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );

    renderApp();
    expect(screen.getByText('Restoring session...')).toBeTruthy();

    await act(async () => {
      resolveSession({ data: { session: null }, error: null });
    });

    expect(await screen.findByText('Get started')).toBeTruthy();
    expect(screen.queryByText('Restoring session...')).toBeNull();
  });

  it('opens the customer app directly when a session is restored', async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    renderApp();

    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    expect(screen.queryByText('Welcome back')).toBeNull();
    expect(screen.queryByText('Get started')).toBeNull();
    expect(screen.queryByText('Restoring session...')).toBeNull();
  });

  it('keeps the customer app protected while unauthenticated', async () => {
    renderApp();

    expect(await screen.findByText('Get started')).toBeTruthy();
    expect(screen.queryByTestId('home-screen')).toBeNull();
  });

  it('shows a safe error and stays on Sign In when credentials are rejected', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('Invalid login credentials', 'invalid_credentials'),
    });

    renderApp('SignIn');
    expect(await screen.findByText('Welcome back')).toBeTruthy();

    await fillAndSubmitSignIn('person@example.com', 'wrong-password');

    expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
    expect(screen.queryByTestId('home-screen')).toBeNull();
    // Regression: the old provider set loading=true during the action, which
    // unmounted the navigator, discarded the error, and reset to Welcome.
    expect(screen.queryByText('Restoring session...')).toBeNull();
    expect(screen.queryByText('Get started')).toBeNull();
    expect(screen.getAllByText('Welcome back')).toHaveLength(1);
  });

  it('navigates to the customer Home after a successful sign in', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null });

    renderApp('SignIn');
    expect(await screen.findByText('Welcome back')).toBeTruthy();

    await fillAndSubmitSignIn('person@example.com', 'correct-password');

    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    expect(screen.queryByText('Welcome back')).toBeNull();
    expect(screen.queryByText('Restoring session...')).toBeNull();
  });

  it('requires e-mail verification explicitly instead of silently returning to Sign In', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { ...user, identities: [{ id: 'email-identity' }] }, session: null },
      error: null,
    });

    renderApp('CreateAccount');
    expect(await screen.findByText('Create your account')).toBeTruthy();

    await fillAndSubmitCreateAccount('person@example.com', 'password123');

    expect(
      await screen.findByText('Account created. Please verify your email to continue.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('home-screen')).toBeNull();
    // Regression: this flow used to navigation.replace('SignIn') silently.
    expect(screen.queryByText('Welcome back')).toBeNull();
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'password123',
      options: {
        data: { full_name: 'Test Person' },
        emailRedirectTo: MOBILE_AUTH_CALLBACK_URL,
      },
    });

    // Resend is wired to the real Supabase resend endpoint with the same
    // canonical redirect target as sign-up.
    auth.resend.mockResolvedValue({ error: null });
    pressTopmost('Resend verification email');
    expect(await screen.findByText('Verification email sent. Check your inbox.')).toBeTruthy();
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'person@example.com',
      options: { emailRedirectTo: MOBILE_AUTH_CALLBACK_URL },
    });

    // Returning to Sign In is an explicit user action, not a silent bounce.
    pressTopmost('Continue to Sign In');
    expect(await screen.findByText('Welcome back')).toBeTruthy();
  });

  it('signs the customer in immediately when Supabase auto-confirms sign-up', async () => {
    auth.signUp.mockResolvedValue({ data: { user, session }, error: null });

    renderApp('CreateAccount');
    expect(await screen.findByText('Create your account')).toBeTruthy();

    await fillAndSubmitCreateAccount('person@example.com', 'password123');

    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    expect(screen.queryByText('Welcome back')).toBeNull();
  });

  it('rejects registration when the address already has an account', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { ...user, identities: [] }, session: null },
      error: null,
    });

    renderApp('CreateAccount');
    expect(await screen.findByText('Create your account')).toBeTruthy();

    await fillAndSubmitCreateAccount('person@example.com', 'password123');

    expect(await screen.findByText('Account already exists. Try signing in instead.')).toBeTruthy();
    expect(screen.queryByText('Check your email')).toBeNull();
    expect(screen.queryByTestId('home-screen')).toBeNull();
  });

  it('returns to the signed-out routes on session expiry and allows signing in again without a restart', async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    renderApp();
    expect(await screen.findByTestId('home-screen')).toBeTruthy();

    // Session expiry / logout event from Supabase.
    await act(async () => {
      authCallback?.('SIGNED_OUT', null);
    });

    expect(await screen.findByText('Get started')).toBeTruthy();
    expect(screen.queryByTestId('home-screen')).toBeNull();
    expect(screen.queryByText('Restoring session...')).toBeNull();
    // Exactly one auth surface — no redirect loop.
    expect(screen.getAllByText('Get started')).toHaveLength(1);

    // Sign in again in the same app session (no Metro/app restart).
    auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null });
    pressTopmost('Sign in');
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    await fillAndSubmitSignIn('person@example.com', 'correct-password');
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
  });

  it('surfaces network failures as a safe message without leaving the screen', async () => {
    auth.signInWithPassword.mockRejectedValue(new TypeError('Network request failed'));

    renderApp('SignIn');
    expect(await screen.findByText('Welcome back')).toBeTruthy();

    await fillAndSubmitSignIn('person@example.com', 'password123');

    expect(
      await screen.findByText('Unable to connect. Check your internet connection and try again.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('home-screen')).toBeNull();
    expect(screen.getAllByText('Welcome back')).toHaveLength(1);
  });

  describe('email confirmation deep link', () => {
    const expiredUrl =
      'turfandtaste://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

    it('exchanges a confirmation callback in the background and opens Home', async () => {
      let resolveSetSession!: (value: { data: { session: Session | null }; error: null }) => void;
      auth.setSession.mockReturnValue(
        new Promise((resolve) => {
          resolveSetSession = resolve;
        }),
      );
      linking.getInitialURL.mockResolvedValue(
        'turfandtaste://auth/callback#access_token=deep-access&refresh_token=deep-refresh',
      );

      renderApp();

      expect(await screen.findByText('Completing verification...')).toBeTruthy();
      expect(screen.queryByTestId('home-screen')).toBeNull();

      await act(async () => {
        resolveSetSession({ data: { session }, error: null });
      });

      expect(await screen.findByTestId('home-screen')).toBeTruthy();
      expect(screen.queryByText('Completing verification...')).toBeNull();
      expect(auth.setSession).toHaveBeenCalledWith({
        access_token: 'deep-access',
        refresh_token: 'deep-refresh',
      });
    });

    it('shows the recoverable expired state with resend, then returns to Sign In without a loop', async () => {
      linking.getInitialURL.mockResolvedValue(expiredUrl);
      pendingRead.mockResolvedValue('person@example.com');

      renderApp();

      expect(await screen.findByText('Verification link expired or invalid')).toBeTruthy();
      expect(
        screen.getByText('Your verification link has expired or is invalid. Request a new one.'),
      ).toBeTruthy();
      expect(screen.getByText('Resend verification email')).toBeTruthy();
      expect(auth.setSession).not.toHaveBeenCalled();
      expect(screen.queryByTestId('home-screen')).toBeNull();
      // No silent navigation: nothing else is on screen, exactly once.
      expect(screen.queryByText('Welcome back')).toBeNull();
      expect(screen.queryByText('Get started')).toBeNull();
      expect(screen.getAllByText('Verification link expired or invalid')).toHaveLength(1);

      // Resend uses the same canonical redirect target as sign-up.
      auth.resend.mockResolvedValue({ error: null });
      pressTopmost('Resend verification email');
      expect(await screen.findByText('Verification email sent. Check your inbox.')).toBeTruthy();
      expect(auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'person@example.com',
        options: { emailRedirectTo: MOBILE_AUTH_CALLBACK_URL },
      });
      // A successful resend does not navigate on its own either.
      expect(screen.getAllByText('Verification link expired or invalid')).toHaveLength(1);

      // Explicit customer action lands directly on Sign In — one surface, no loop.
      pressTopmost('Back to Sign In');
      expect(await screen.findByText('Welcome back')).toBeTruthy();
      expect(screen.queryByText('Verification link expired or invalid')).toBeNull();
      expect(screen.getAllByText('Welcome back')).toHaveLength(1);
      expect(screen.queryByTestId('home-screen')).toBeNull();
    });

    it('offers only Sign In when no pending address survived on the device', async () => {
      linking.getInitialURL.mockResolvedValue(expiredUrl);
      pendingRead.mockResolvedValue(null);

      renderApp();

      expect(await screen.findByText('Verification link expired or invalid')).toBeTruthy();
      expect(screen.queryByText('Resend verification email')).toBeNull();
      expect(screen.getByText('Back to Sign In')).toBeTruthy();
    });

    it('keeps a signed-in customer in the app when a stale confirmation link arrives', async () => {
      auth.getSession.mockResolvedValue({ data: { session }, error: null });
      linking.getInitialURL.mockResolvedValue(expiredUrl);

      renderApp();
      expect(await screen.findByTestId('home-screen')).toBeTruthy();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.queryByText('Verification link expired or invalid')).toBeNull();
      expect(screen.getAllByTestId('home-screen')).toHaveLength(1);
      expect(screen.queryByText('Restoring session...')).toBeNull();
    });

    it('handles a confirmation link that arrives while the app is already open', async () => {
      renderApp();
      expect(await screen.findByText('Get started')).toBeTruthy();
      pendingRead.mockResolvedValue('person@example.com');

      const listener = linking.addEventListener.mock.calls[0]?.[1] as (event: {
        url: string;
      }) => void;
      expect(typeof listener).toBe('function');

      await act(async () => {
        listener({ url: expiredUrl });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(await screen.findByText('Verification link expired or invalid')).toBeTruthy();
      expect(screen.queryByTestId('home-screen')).toBeNull();
    });
  });
});
