import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';

const authStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase public credentials');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export interface CustomerAuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export type AuthListener = (
  event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED',
  session: Session | null,
) => void;

let authListener: AuthListener | null = null;

export function setAuthListener(listener: AuthListener) {
  authListener = listener;
}

export function clearAuthListener() {
  authListener = null;
}

function notifyListener(
  event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED',
  session: Session | null,
) {
  if (authListener) {
    authListener(event, session);
  }
}

export async function initializeAuth(): Promise<{ user: User | null; session: Session | null }> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Failed to get session: ${error.message}`);
  }
  return { user: data.session?.user ?? null, session: data.session ?? null };
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
): Promise<{ user: User | null; error: Error | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) {
    return { user: null, error: new Error(error.message) };
  }
  if (data.session) {
    notifyListener('SIGNED_IN', data.session);
  }
  return { user: data.user ?? null, error: null };
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: User | null; error: Error | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return { user: null, error: new Error(error.message) };
  }
  if (data.session) {
    notifyListener('SIGNED_IN', data.session);
  }
  return { user: data.user, error: null };
}

export async function signOut(): Promise<Error | null> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return new Error(error.message);
  }
  notifyListener('SIGNED_OUT', null);
  return null;
}

export async function resetPassword(email: string): Promise<Error | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'turfandtaste://reset-password',
  });
  if (error) {
    return new Error(error.message);
  }
  return null;
}

export async function updatePassword(newPassword: string): Promise<Error | null> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) {
    return new Error(error.message);
  }
  return null;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return data.user;
}

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return null;
  }
  return data.session.access_token;
}

export async function refreshSession(): Promise<{ session: Session | null; error: Error | null }> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    return { session: null, error: new Error(error.message) };
  }
  if (data.session) {
    notifyListener('TOKEN_REFRESHED', data.session);
  }
  return { session: data.session, error: null };
}

supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
  const eventMap: Record<string, 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED'> =
    {
      SIGNED_IN: 'SIGNED_IN',
      SIGNED_OUT: 'SIGNED_OUT',
      TOKEN_REFRESHED: 'TOKEN_REFRESHED',
      USER_UPDATED: 'USER_UPDATED',
    };
  const mappedEvent = eventMap[event];
  if (mappedEvent) {
    notifyListener(mappedEvent, session);
  }
});
