import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, type CustomerAuthState } from '../auth/supabase';
import { logAuthDiagnostics, toFriendlyAuthError } from '../auth/authErrors';
import type { User, Session } from '@supabase/supabase-js';

export interface SignUpResult {
  error: Error | null;
  /** True only when Supabase returned an immediate session (auto-confirm on). */
  signedIn: boolean;
  /** True when the account was created but e-mail verification is required first. */
  verificationRequired: boolean;
}

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

  const updateState = (partial: Partial<CustomerAuthState>) => {
    setState((prev) => ({ ...prev, ...partial }));
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
        options: { data: { full_name: fullName } },
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
    return null;
  };

  const handleResetPassword = async (email: string): Promise<Error | null> => {
    updateState({ error: null });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'turfandtaste://reset-password',
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
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        logAuthDiagnostics('resendVerification', error);
        const friendly = toFriendlyAuthError('resendVerification', error);
        updateState({ error: friendly });
        return new Error(friendly);
      }
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
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        updateState({ user: session?.user ?? null, session, error: null });
      }
      // INITIAL_SESSION and other events are ignored: hydration is owned by
      // the explicit getSession() above.
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

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
