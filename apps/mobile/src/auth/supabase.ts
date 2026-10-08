import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';
import { resolveSupabasePublicConfig } from './supabaseConfig';

const authStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Fails fast with a clear configuration error when the public Supabase env is
// missing, still dotenvx-encrypted, or not a URL — before createClient() runs.
const { supabaseUrl, supabaseAnonKey } = resolveSupabasePublicConfig();

// The customer session is persisted in the device keychain via SecureStore.
// All auth calls flow through the AuthProvider (src/context/AuthContext.tsx),
// which subscribes to onAuthStateChange and is the single source of truth
// for authentication state.
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
  /** True only while the initial session hydration is running. */
  loading: boolean;
  error: string | null;
}
