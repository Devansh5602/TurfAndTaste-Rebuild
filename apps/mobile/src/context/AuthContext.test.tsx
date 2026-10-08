import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import type { Session, User } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from './AuthContext';
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

let context: ReturnType<typeof useAuth>;
let loadingHistory: boolean[] = [];
let authCallback: ((event: string, session: Session | null) => void) | null = null;
const unsubscribe = jest.fn();

function Capture() {
  context = useAuth();
  loadingHistory.push(context.loading);
  return null;
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Capture />
    </AuthProvider>,
  );
}

async function waitForHydration() {
  await waitFor(() => expect(context.loading).toBe(false));
}

/**
 * loading may only be true during initial hydration: once it first turns
 * false, no auth action is allowed to flip it back (that is what used to
 * unmount the navigator mid-action).
 */
function loadingAfterHydrationIsStable(): boolean {
  const firstFalse = loadingHistory.indexOf(false);
  if (firstFalse === -1) return false;
  return loadingHistory.slice(firstFalse).every((value) => value === false);
}

function authError(message: string, code?: string): Error {
  const error = new Error(message);
  error.name = 'AuthApiError';
  if (code !== undefined) {
    (error as Error & { code?: string }).code = code;
  }
  return error;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadingHistory = [];
    authCallback = null;
    unsubscribe.mockClear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.onAuthStateChange.mockImplementation((callback: typeof authCallback) => {
      authCallback = callback as (event: string, session: Session | null) => void;
      return { data: { subscription: { unsubscribe } } };
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  describe('initial hydration', () => {
    it('starts in loading state and finishes unauthenticated when no session exists', async () => {
      renderProvider();
      expect(loadingHistory[0]).toBe(true);
      await waitForHydration();
      expect(context.session).toBeNull();
      expect(context.user).toBeNull();
      expect(context.error).toBeNull();
    });

    it('restores an existing session without ever re-entering loading', async () => {
      auth.getSession.mockResolvedValue({ data: { session }, error: null });

      renderProvider();
      await waitForHydration();

      expect(context.session).toBe(session);
      expect(context.user).toBe(user);
      expect(loadingAfterHydrationIsStable()).toBe(true);
    });

    it('finishes hydration with an error instead of blocking forever', async () => {
      auth.getSession.mockResolvedValue({
        data: { session: null },
        error: authError('storage blew up'),
      });

      renderProvider();
      await waitForHydration();

      expect(context.session).toBeNull();
      expect(context.error).toBe('Unable to restore your session. Please try again.');
      expect(loadingAfterHydrationIsStable()).toBe(true);
    });

    it('unsubscribes from auth events on unmount', async () => {
      const { unmount } = renderProvider();
      await waitForHydration();
      await act(async () => {
        unmount();
      });
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('sign in', () => {
    it('succeeding authenticates without ever re-triggering loading', async () => {
      renderProvider();
      await waitForHydration();

      auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null });
      let failure!: Error | null;
      await act(async () => {
        failure = await context.signIn('person@example.com', 'correct-password');
      });

      expect(failure).toBeNull();
      expect(context.session).toBe(session);
      expect(context.user).toBe(user);
      expect(context.error).toBeNull();
      expect(context.loading).toBe(false);
      expect(loadingAfterHydrationIsStable()).toBe(true);
    });

    it('failing does not authenticate and surfaces a safe message', async () => {
      renderProvider();
      await waitForHydration();

      auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: authError('Invalid login credentials', 'invalid_credentials'),
      });
      let failure!: Error | null;
      await act(async () => {
        failure = await context.signIn('person@example.com', 'wrong-password');
      });

      expect(failure?.message).toBe('Invalid email or password');
      expect(context.session).toBeNull();
      expect(context.error).toBe('Invalid email or password');
      // The historical defect: a failed sign-in left loading stuck at true,
      // which unmounted the navigator and silently discarded the error.
      expect(context.loading).toBe(false);
      expect(loadingAfterHydrationIsStable()).toBe(true);
    });

    it('reports unverified e-mail distinctly from bad credentials', async () => {
      renderProvider();
      await waitForHydration();

      auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: authError('Email not confirmed', 'email_not_confirmed'),
      });
      let failure!: Error | null;
      await act(async () => {
        failure = await context.signIn('person@example.com', 'any-password');
      });

      expect(failure?.message).toBe('Please verify your email before signing in.');
      expect(context.session).toBeNull();
      expect(context.loading).toBe(false);
    });

    it('maps unexpected network exceptions instead of rejecting the caller', async () => {
      renderProvider();
      await waitForHydration();

      auth.signInWithPassword.mockRejectedValue(new TypeError('Network request failed'));
      let failure!: Error | null;
      await act(async () => {
        failure = await context.signIn('person@example.com', 'any-password');
      });

      expect(failure?.message).toBe(
        'Network unavailable. Please check your connection and try again.',
      );
      expect(context.session).toBeNull();
      expect(context.loading).toBe(false);
      expect(loadingAfterHydrationIsStable()).toBe(true);
    });
  });

  describe('registration', () => {
    it('treats an immediate session as authenticated', async () => {
      renderProvider();
      await waitForHydration();

      auth.signUp.mockResolvedValue({ data: { user, session }, error: null });
      let result!: Awaited<ReturnType<typeof context.signUp>>;
      await act(async () => {
        result = await context.signUp('person@example.com', 'a-strong-password', 'Person One');
      });

      expect(result).toEqual({ error: null, signedIn: true, verificationRequired: false });
      expect(context.session).toBe(session);
      expect(loadingAfterHydrationIsStable()).toBe(true);
    });

    it('reports a verification-required account without claiming sign-in', async () => {
      renderProvider();
      await waitForHydration();

      auth.signUp.mockResolvedValue({
        data: { user: { ...user, identities: [{ id: 'email-identity' }] }, session: null },
        error: null,
      });
      let result!: Awaited<ReturnType<typeof context.signUp>>;
      await act(async () => {
        result = await context.signUp('person@example.com', 'a-strong-password', 'Person One');
      });

      expect(result).toEqual({ error: null, signedIn: false, verificationRequired: true });
      expect(context.session).toBeNull();
      expect(context.user).toBeNull();
      expect(context.error).toBeNull();
      expect(context.loading).toBe(false);
      expect(loadingAfterHydrationIsStable()).toBe(true);
    });

    it('rejects registration for an address that already has an account', async () => {
      renderProvider();
      await waitForHydration();

      auth.signUp.mockResolvedValue({
        data: { user: { ...user, identities: [] }, session: null },
        error: null,
      });
      let result!: Awaited<ReturnType<typeof context.signUp>>;
      await act(async () => {
        result = await context.signUp('person@example.com', 'a-strong-password', 'Person One');
      });

      expect(result?.signedIn).toBe(false);
      expect(result?.verificationRequired).toBe(false);
      expect(result?.error?.message).toBe('Account already exists. Try signing in instead.');
      expect(context.session).toBeNull();
      expect(context.error).toBe('Account already exists. Try signing in instead.');
    });

    it('surfaces Supabase sign-up errors with safe copy', async () => {
      renderProvider();
      await waitForHydration();

      auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: authError('Password should be at least 8 characters.', 'weak_password'),
      });
      let result!: Awaited<ReturnType<typeof context.signUp>>;
      await act(async () => {
        result = await context.signUp('person@example.com', 'short', 'Person One');
      });

      expect(result?.error?.message).toBe(
        'Password is too weak. Please choose a different password.',
      );
      expect(result?.signedIn).toBe(false);
      expect(result?.verificationRequired).toBe(false);
      expect(context.session).toBeNull();
    });
  });

  describe('sign out and session lifecycle', () => {
    it('logout clears the session even when server-side revoke fails', async () => {
      auth.getSession.mockResolvedValue({ data: { session }, error: null });
      renderProvider();
      await waitForHydration();
      expect(context.session).toBe(session);

      auth.signOut.mockResolvedValue({ error: authError('server unreachable') });
      let failure!: Error | null;
      await act(async () => {
        failure = await context.signOut();
      });

      expect(failure).toBeNull();
      expect(context.session).toBeNull();
      expect(context.user).toBeNull();
      expect(context.loading).toBe(false);
    });

    it('reacts to a SIGNED_OUT event (logout elsewhere or session expiry)', async () => {
      auth.getSession.mockResolvedValue({ data: { session }, error: null });
      renderProvider();
      await waitForHydration();
      expect(context.session).toBe(session);

      await act(async () => {
        authCallback?.('SIGNED_OUT', null);
      });

      expect(context.session).toBeNull();
      expect(context.user).toBeNull();
      expect(context.loading).toBe(false);
      expect(loadingAfterHydrationIsStable()).toBe(true);
    });

    it('applies token refreshes from the auth event stream', async () => {
      auth.getSession.mockResolvedValue({ data: { session }, error: null });
      renderProvider();
      await waitForHydration();

      const refreshed = { ...session, access_token: 'rotated-token' } as Session;
      await act(async () => {
        authCallback?.('TOKEN_REFRESHED', refreshed);
      });

      expect(context.session).toBe(refreshed);
      expect(context.loading).toBe(false);
    });

    it('ignores INITIAL_SESSION(null) so hydration never bounces a valid session', async () => {
      auth.getSession.mockResolvedValue({ data: { session }, error: null });
      renderProvider();
      await waitForHydration();
      expect(context.session).toBe(session);

      await act(async () => {
        authCallback?.('INITIAL_SESSION', null);
      });

      expect(context.session).toBe(session);
      expect(context.loading).toBe(false);
    });
  });

  describe('password reset and verification resend', () => {
    it('sends a reset e-mail and returns no error on success', async () => {
      renderProvider();
      await waitForHydration();

      auth.resetPasswordForEmail.mockResolvedValue({ error: null });
      let failure!: Error | null;
      await act(async () => {
        failure = await context.resetPassword('person@example.com');
      });

      expect(failure).toBeNull();
      expect(loadingAfterHydrationIsStable()).toBe(true);
    });

    it('maps reset e-mail failures to safe copy', async () => {
      renderProvider();
      await waitForHydration();

      auth.resetPasswordForEmail.mockResolvedValue({
        error: authError('For security purposes, try later.', 'over_email_send_rate_limit'),
      });
      let failure!: Error | null;
      await act(async () => {
        failure = await context.resetPassword('person@example.com');
      });

      expect(failure?.message).toBe('Too many attempts. Please wait a moment and try again.');
      expect(context.loading).toBe(false);
    });

    it('resends verification e-mail through Supabase', async () => {
      renderProvider();
      await waitForHydration();

      auth.resend.mockResolvedValue({ error: null });
      let failure!: Error | null;
      await act(async () => {
        failure = await context.resendVerificationEmail('person@example.com');
      });

      expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'person@example.com' });
      expect(failure).toBeNull();
      expect(context.loading).toBe(false);
    });
  });

  describe('access tokens', () => {
    it('returns the session access token for API calls', async () => {
      auth.getSession.mockResolvedValue({ data: { session }, error: null });
      renderProvider();
      await waitForHydration();

      let token: string | null = null;
      await act(async () => {
        token = await context.getAccessToken();
      });

      expect(token).toBe('access-token-value');
    });
  });
});
