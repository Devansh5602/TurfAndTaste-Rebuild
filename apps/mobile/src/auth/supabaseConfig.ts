/**
 * Defensive resolution of the public Supabase configuration for the mobile app.
 *
 * Expo inlines `EXPO_PUBLIC_*` variables into the JS bundle at bundle time, so
 * this module runs against whatever literal Metro captured. It fails fast with a
 * developer-facing configuration error instead of an obscure `createClient()`
 * crash, and it never echoes credential values into logs or error messages.
 */

const ENCRYPTED_PREFIX = 'encrypted:';
const REPO_HINT =
  'Define it in apps/mobile/.env (dotenvx-encrypted) or apps/mobile/.env.local ' +
  '(plaintext, git-ignored), then restart Metro with: npx expo start --dev-client --clear';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export interface SupabasePublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function requirePublicEnv(
  env: Record<string, string | undefined>,
  name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
): string {
  const raw = env[name];
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (!value) {
    throw new Error(`[supabase config] ${name} is missing or empty. ${REPO_HINT}`);
  }

  if (value.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error(
      `[supabase config] ${name} is a dotenvx-encrypted value ("encrypted:...") instead of a ` +
        'decrypted secret. Expo cannot decrypt .env files; it inlines the raw ciphertext at ' +
        'bundle time. Restart Metro through dotenvx so the value is decrypted first: ' +
        'pnpm env:mobile npx expo start --dev-client --clear (from the repository root), ' +
        'or keep decrypted values in apps/mobile/.env.local.',
    );
  }

  if (value.startsWith('"') || value.startsWith("'")) {
    throw new Error(
      `[supabase config] ${name} still contains surrounding quotes. Remove the quotes from the ` +
        'value in the env file and restart Metro.',
    );
  }

  if (value.includes('\n')) {
    throw new Error(
      `[supabase config] ${name} contains a line break. The value must be a single line; fix the ` +
        'env file and restart Metro.',
    );
  }

  return value;
}

/** Minimal base64url decoder; React Native does not ship a global `atob`. */
function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  let output = '';
  for (let i = 0; i < padded.length; i += 4) {
    const c1 = BASE64_CHARS.indexOf(padded[i] ?? '');
    const c2 = BASE64_CHARS.indexOf(padded[i + 1] ?? '');
    const c3 = BASE64_CHARS.indexOf(padded[i + 2] ?? '');
    const c4 = BASE64_CHARS.indexOf(padded[i + 3] ?? '');
    if (c1 < 0 || c2 < 0) {
      throw new Error('invalid base64');
    }
    const group = (c1 << 18) | (c2 << 12) | ((c3 < 0 ? 0 : c3) << 6) | (c4 < 0 ? 0 : c4);
    output += String.fromCharCode((group >> 16) & 0xff);
    if (c3 >= 0) output += String.fromCharCode((group >> 8) & 0xff);
    if (c4 >= 0) output += String.fromCharCode(group & 0xff);
  }
  return output;
}

/** Returns the decoded `role` claim of a legacy Supabase JWT, or null when not a JWT. */
function readLegacyJwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3 || !parts[0]?.startsWith('eyJ')) return null;
  try {
    const payload: unknown = JSON.parse(decodeBase64Url(parts[1] ?? ''));
    const role = (payload as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

export function resolveSupabasePublicConfig(
  env: Record<string, string | undefined> = process.env,
): SupabasePublicConfig {
  const supabaseUrl = requirePublicEnv(env, 'EXPO_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = requirePublicEnv(env, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

  if (!/^https?:\/\//i.test(supabaseUrl)) {
    throw new Error(
      '[supabase config] EXPO_PUBLIC_SUPABASE_URL must begin with https://. The captured value ' +
        'is not a URL (possible stray quotes or whitespace). Value withheld from logs.',
    );
  }
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new Error(
      '[supabase config] EXPO_PUBLIC_SUPABASE_URL is malformed and cannot be parsed as a URL. ' +
        'Value withheld from logs.',
    );
  }

  // The mobile client may only ship the public/anon credential — never a
  // server-only secret, regardless of how it ends up in the environment.
  if (supabaseAnonKey.startsWith('sb_secret_')) {
    throw new Error(
      '[supabase config] EXPO_PUBLIC_SUPABASE_ANON_KEY is a secret key (sb_secret_...). ' +
        'Server-only credentials must never ship in the mobile app; use the anon/publishable key.',
    );
  }
  if (readLegacyJwtRole(supabaseAnonKey) === 'service_role') {
    throw new Error(
      '[supabase config] EXPO_PUBLIC_SUPABASE_ANON_KEY is a service_role JWT. Server-only ' +
        'credentials must never ship in the mobile app; use the anon/publishable key.',
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}
