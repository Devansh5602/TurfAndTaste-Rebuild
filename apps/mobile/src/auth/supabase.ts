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

/**
 * Pending e-mail verification address, kept in the device keychain.
 *
 * The confirmation link often opens the app after the OS has killed the
 * sign-up screen, so the recoverable "link expired" state can only offer
 * "Resend verification email" if the address survived the restart. It is
 * cleared as soon as a session is established (verification completed).
 * This is device-local PII, never synced and never sent anywhere by this
 * module — Supabase already knows the address from sign-up.
 */
const PENDING_VERIFICATION_EMAIL_KEY = 'turfandtaste.pending-verification-email';

export async function readPendingVerificationEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PENDING_VERIFICATION_EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function storePendingVerificationEmail(email: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PENDING_VERIFICATION_EMAIL_KEY, email);
  } catch {
    // Non-fatal: only the convenience resend action degrades.
  }
}

export async function clearPendingVerificationEmail(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PENDING_VERIFICATION_EMAIL_KEY);
  } catch {
    // Non-fatal: stale address would only be reused for another resend.
  }
}
