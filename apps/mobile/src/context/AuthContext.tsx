import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, type CustomerAuthState } from '../auth/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue extends CustomerAuthState {
  signIn: (email: string, password: string) => Promise<Error | null>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: Error | null; signedIn: boolean }>;
  signOut: () => Promise<Error | null>;
  resetPassword: (email: string) => Promise<Error | null>;
  refreshSession: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  user: User | null;
  session: Session | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
    updateState({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      updateState({ loading: false, error: error.message });
      return new Error(error.message);
    }
    const session = await supabase.auth.getSession();
    updateState({
      user: data.user ?? null,
      session: session.data.session,
      loading: false,
      error: null,
    });
    return null;
  };

  const handleSignUp = async (
    email: string,
    password: string,
    fullName: string,
  ): Promise<{ error: Error | null; signedIn: boolean }> => {
    updateState({ loading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      updateState({ loading: false, error: error.message });
      return { error: new Error(error.message), signedIn: false };
    }
    if (data.session) {
      updateState({ user: data.user, session: data.session, loading: false, error: null });
    } else {
      updateState({ user: data.user, session: null, loading: false, error: null });
    }
    return { error: null, signedIn: data.session !== null };
  };

  const handleSignOut = async (): Promise<Error | null> => {
    updateState({ loading: true, error: null });
    const { error } = await supabase.auth.signOut();
    if (error) {
      updateState({ loading: false, error: error.message });
      return new Error(error.message);
    }
    updateState({ user: null, session: null, loading: false, error: null });
    return null;
  };

  const handleResetPassword = async (email: string): Promise<Error | null> => {
    updateState({ loading: true, error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'turfandtaste://reset-password',
    });
    if (error) {
      updateState({ loading: false, error: error.message });
      return new Error(error.message);
    }
    updateState({ loading: false, error: null });
    return null;
  };

  const handleRefreshSession = async (): Promise<void> => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      updateState({ error: error.message });
    } else if (data.session) {
      updateState({ session: data.session, user: data.session.user });
    }
  };

  const handleGetAccessToken = async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      return null;
    }
    return data.session.access_token;
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          if (mounted) {
            updateState({ loading: false, error: error.message });
          }
          return;
        }
        if (mounted) {
          updateState({
            user: data.session?.user ?? null,
            session: data.session ?? null,
            loading: false,
            error: null,
          });
        }
      } catch {
        if (mounted) {
          updateState({ loading: false, error: 'Failed to initialize auth' });
        }
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        updateState({ user: null, session: null, loading: false });
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        updateState({ user: session?.user ?? null, session, loading: false });
      }
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
