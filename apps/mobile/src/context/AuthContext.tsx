import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import {
  clearPendingVerificationEmail,
  readPendingVerificationEmail,
  storePendingVerificationEmail,
  supabase,
  type CustomerAuthState,
} from '../auth/supabase';
import { logAuthDiagnostics, toFriendlyAuthError } from '../auth/authErrors';
import {
  establishAuthCallbackSession,
  GENERIC_RETRY_MESSAGE,
  isAuthCallbackUrl,
  MOBILE_AUTH_CALLBACK_URL,
  MOBILE_RESET_REDIRECT_URL,
  VERIFICATION_FAILED_TITLE,
} from '../auth/authCallback';
import type { User, Session } from '@supabase/supabase-js';

export interface SignUpResult {
  error: Error | null;
  /** True only when Supabase returned an immediate session (auto-confirm on). */
  signedIn: boolean;
  /** True when the account was created but e-mail verification is required first. */
  verificationRequired: boolean;
}

/**
 * State machine for the e-mail confirmation deep link:
 *
 * - `idle`       — no callback in flight (normal signed-out/signed-in states).
 * - `processing` — a `turfandtaste://auth/callback` URL is being exchanged.
 * - `invalid`    — the link was expired/invalid/malformed; the branded
 *                  recoverable state is shown (resend + back to Sign In).
 * - `signInEntry`— the customer left that state toward Sign In; the auth
 *                  navigator mounts with SignIn as its initial route.
 *
 * Transitions happen only through explicit events (URL arrival, session
 * established, user action) — there is no automatic edge, so no loop.
 */
export type EmailConfirmationState =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'invalid'; title: string; message: string }
  | { status: 'signInEntry' };

interface AuthContextValue extends CustomerAuthState {
  signIn: (email: string, password: string) => Promise<Error | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>;
  signOut: () => Promise<Error | null>;
  resetPassword: (email: string) => Promise<Error | null>;
  resendVerificationEmail: (email: string) => Promise<Error | null>;
  refreshSession: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  user: User | null;
  session: Session | null;
  emailConfirmation: EmailConfirmationState;
  /** Address stored for a pending verification, if known (null otherwise). */
  pendingVerificationEmail: string | null;
  /** Leaves the expired-link state toward the Sign In screen. */
  dismissEmailConfirmation: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Single source of truth for customer authentication state.
 *
 * `loading` means ONLY "initial session hydration is still running". It is
 * set exactly once (true on mount, false when the initial getSession()
 * settles) and is never toggled by sign-in/sign-up/sign-out actions, so the
 * route guard never tears down the navigator while an action is in flight.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CustomerAuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });
  const [emailConfirmation, setEmailConfirmation] = useState<EmailConfirmationState>({
    status: 'idle',
  });
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  const updateState = (partial: Partial<CustomerAuthState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  /**
   * Any established session means verification is behind us: drop the
   * callback state and forget the stored address (state + keychain).
   */
  const clearVerificationProgress = () => {
    setEmailConfirmation((prev) => (prev.status === 'idle' ? prev : { status: 'idle' }));
    setPendingVerificationEmail(null);
    void clearPendingVerificationEmail();
  };

  const handleSignIn = async (email: string, password: string): Promise<Error | null> => {
    updateState({ error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        logAuthDiagnostics('signIn', error);
        const friendly = toFriendlyAuthError('signIn', error);
        updateState({ error: friendly });
        return new Error(friendly);
      }
      // auth-js guarantees a session on success; the SIGNED_IN listener also
      // lands this state, so the assignment below is idempotent.
      const session = data.session;
      updateState({
        user: session?.user ?? data.user ?? null,
        session: session ?? null,
        error: null,
      });
      if (session) clearVerificationProgress();
      return null;
    } catch (unexpected) {
      logAuthDiagnostics('signIn (unexpected)', unexpected);
      const friendly = toFriendlyAuthError('signIn', unexpected);
      updateState({ error: friendly });
      return new Error(friendly);
    }
  };

  const handleSignUp = async (
    email: string,
    password: string,
    fullName: string,
  ): Promise<SignUpResult> => {
    updateState({ error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // The confirmation e-mail must return to this app's canonical
        // callback — never the Supabase Site URL (which may be localhost).
        options: {
          data: { full_name: fullName },
          emailRedirectTo: MOBILE_AUTH_CALLBACK_URL,
        },
      });
      if (error) {
        logAuthDiagnostics('signUp', error);
        const friendly = toFriendlyAuthError('signUp', error);
        updateState({ error: friendly });
        return { error: new Error(friendly), signedIn: false, verificationRequired: false };
      }

      const user = data.user;
      const session = data.session;

      if (session) {
        updateState({ user: session.user ?? user, session, error: null });
        clearVerificationProgress();
        return { error: null, signedIn: true, verificationRequired: false };
      }

      // GoTrue returns an obfuscated user with an empty identities list when
      // the address already has an account (confirmed or not).
      if (user && Array.isArray(user.identities) && user.identities.length === 0) {
        const message = 'Account already exists. Try signing in instead.';
        updateState({ error: message });
        return { error: new Error(message), signedIn: false, verificationRequired: false };
      }

      if (user) {
        // Account created, but Supabase requires e-mail verification before a
        // session can be issued. Not signed in — caller must say so clearly.
        // Remember the address so a deep link arriving after an app restart
        // can still offer "Resend verification email".
        void storePendingVerificationEmail(email);
        updateState({ user: null, session: null, error: null });
        return { error: null, signedIn: false, verificationRequired: true };
      }

      const message = 'Unable to create your account. Please try again.';
      updateState({ error: message });
      return { error: new Error(message), signedIn: false, verificationRequired: false };
    } catch (unexpected) {
      logAuthDiagnostics('signUp (unexpected)', unexpected);
      const friendly = toFriendlyAuthError('signUp', unexpected);
      updateState({ error: friendly });
      return { error: new Error(friendly), signedIn: false, verificationRequired: false };
    }
  };

  const handleSignOut = async (): Promise<Error | null> => {
    updateState({ error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // auth-js always clears the local session even when server-side
        // revocation fails; logout still succeeds on this device.
        logAuthDiagnostics('signOut (server-side revoke)', error);
      }
    } catch (unexpected) {
      logAuthDiagnostics('signOut (unexpected)', unexpected);
    }
    updateState({ user: null, session: null, error: null });
    clearVerificationProgress();
    return null;
  };

  const handleResetPassword = async (email: string): Promise<Error | null> => {
    updateState({ error: null });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: MOBILE_RESET_REDIRECT_URL,
      });
      if (error) {
        logAuthDiagnostics('resetPassword', error);
        const friendly = toFriendlyAuthError('resetPassword', error);
        updateState({ error: friendly });
        return new Error(friendly);
      }
      return null;
    } catch (unexpected) {
      logAuthDiagnostics('resetPassword (unexpected)', unexpected);
      const friendly = toFriendlyAuthError('resetPassword', unexpected);
      updateState({ error: friendly });
      return new Error(friendly);
    }
  };

  const handleResendVerificationEmail = async (email: string): Promise<Error | null> => {
    updateState({ error: null });
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        // Same canonical callback as sign-up: a resent link must deep-link
        // back into the app exactly like the original confirmation e-mail.
        options: { emailRedirectTo: MOBILE_AUTH_CALLBACK_URL },
      });
      if (error) {
        logAuthDiagnostics('resendVerification', error);
        const friendly = toFriendlyAuthError('resendVerification', error);
        updateState({ error: friendly });
        return new Error(friendly);
      }
      void storePendingVerificationEmail(email);
      return null;
    } catch (unexpected) {
      logAuthDiagnostics('resendVerification (unexpected)', unexpected);
      const friendly = toFriendlyAuthError('resendVerification', unexpected);
      updateState({ error: friendly });
      return new Error(friendly);
    }
  };

  const handleRefreshSession = async (): Promise<void> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        // Expiry/removal is surfaced through the SIGNED_OUT auth event; a
        // raw refresh error is diagnostics-only.
        logAuthDiagnostics('refreshSession', error);
        return;
      }
      if (data.session) {
        updateState({ session: data.session, user: data.session.user });
      }
    } catch (unexpected) {
      logAuthDiagnostics('refreshSession (unexpected)', unexpected);
    }
  };

  const handleGetAccessToken = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        return null;
      }
      return data.session.access_token;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) {
          logAuthDiagnostics('initial getSession', error);
          updateState({
            loading: false,
            user: null,
            session: null,
            error: 'Unable to restore your session. Please try again.',
          });
          return;
        }
        updateState({
          user: data.session?.user ?? null,
          session: data.session ?? null,
          loading: false,
          error: null,
        });
      } catch (unexpected) {
        if (!mounted) return;
        logAuthDiagnostics('initial getSession (unexpected)', unexpected);
        updateState({
          loading: false,
          user: null,
          session: null,
          error: 'Unable to restore your session. Please try again.',
        });
      }
    };

    hydrate();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        updateState({ user: null, session: null, error: null });
        clearVerificationProgress();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        updateState({ user: session?.user ?? null, session, error: null });
        if (event === 'SIGNED_IN' && session) clearVerificationProgress();
      }
      // INITIAL_SESSION and other events are ignored: hydration is owned by
      // the explicit getSession() above.
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  /**
   * Canonical confirmation deep-link callback (`turfandtaste://auth/callback`).
   *
   * The confirmation e-mail opens this URL; the app owns it end to end —
   * parse, exchange with Supabase, then either establish the session (the
   * route guard swaps to the customer navigator on its own) or show the
   * recoverable expired/invalid state. React Navigation never sees the URL,
   * so tokens never enter navigation state or devtools logs.
   */
  useEffect(() => {
    let mounted = true;

    const handleUrl = async (url: string) => {
      if (!isAuthCallbackUrl(url)) return;
      try {
        setEmailConfirmation({ status: 'processing' });
        const outcome = await establishAuthCallbackSession(supabase, url);
        if (!mounted) return;

        if (outcome.status === 'ignored') {
          setEmailConfirmation({ status: 'idle' });
          return;
        }

        if (outcome.status === 'session') {
          // Also assigned here (idempotently, same as sign-in) so the
          // transition never depends solely on event-stream timing.
          updateState({
            user: outcome.session.user ?? null,
            session: outcome.session,
            error: null,
          });
          clearVerificationProgress();
          return;
        }

        // invalid: surface the branded recoverable state, with the stored
        // address so "Resend verification email" works after a cold start.
        const pending = await readPendingVerificationEmail();
        if (!mounted) return;
        setPendingVerificationEmail(pending ?? null);
        setEmailConfirmation({
          status: 'invalid',
          title: outcome.title,
          message: outcome.message,
        });
      } catch (unexpected) {
        // establishAuthCallbackSession maps its own failures; this last
        // resort guarantees a callback can never crash or silently vanish.
        logAuthDiagnostics('emailConfirmation URL handler (unexpected)', unexpected);
        if (!mounted) return;
        setEmailConfirmation({
          status: 'invalid',
          title: VERIFICATION_FAILED_TITLE,
          message: GENERIC_RETRY_MESSAGE,
        });
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (url && mounted) void handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const dismissEmailConfirmation = () => {
    setEmailConfirmation((prev) => (prev.status === 'invalid' ? { status: 'signInEntry' } : prev));
  };

  const value: AuthContextValue = {
    ...state,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    resetPassword: handleResetPassword,
    resendVerificationEmail: handleResendVerificationEmail,
    refreshSession: handleRefreshSession,
    getAccessToken: handleGetAccessToken,
    user: state.user,
    session: state.session,
    emailConfirmation,
    pendingVerificationEmail,
    dismissEmailConfirmation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
