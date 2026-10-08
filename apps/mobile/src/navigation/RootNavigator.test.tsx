import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { Session, User } from '@supabase/supabase-js';
import { ThemeProvider } from '@turf-and-taste/ui-native';
import { AuthProvider } from '../context/AuthContext';
import { RootNavigator } from './RootNavigator';
import { supabase } from '../auth/supabase';

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
  };
  return { supabase: { auth } };
});

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
}
const auth = supabase.auth as unknown as AuthMock;

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

    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
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
      options: { data: { full_name: 'Test Person' } },
    });

    // Resend is wired to the real Supabase resend endpoint.
    auth.resend.mockResolvedValue({ error: null });
    pressTopmost('Resend verification email');
    expect(await screen.findByText('Verification email sent. Check your inbox.')).toBeTruthy();
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'person@example.com',
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
      await screen.findByText('Network unavailable. Please check your connection and try again.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('home-screen')).toBeNull();
    expect(screen.getAllByText('Welcome back')).toHaveLength(1);
  });
});
