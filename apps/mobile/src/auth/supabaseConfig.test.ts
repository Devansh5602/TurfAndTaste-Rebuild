import { resolveSupabasePublicConfig } from './supabaseConfig';

const VALID_URL = 'https://example-project.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_example1234567890abcdef';

function legacyJwt(role: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return [encode({ alg: 'HS256', typ: 'JWT' }), encode({ role, ref: 'example' }), 'signature'].join(
    '.',
  );
}

function env(overrides: Record<string, string | undefined>): Record<string, string | undefined> {
  return {
    EXPO_PUBLIC_SUPABASE_URL: VALID_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: PUBLISHABLE_KEY,
    ...overrides,
  };
}

describe('resolveSupabasePublicConfig', () => {
  it('returns the trimmed URL and key for a valid public configuration', () => {
    expect(
      resolveSupabasePublicConfig(env({ EXPO_PUBLIC_SUPABASE_URL: `  ${VALID_URL}  ` })),
    ).toEqual({ supabaseUrl: VALID_URL, supabaseAnonKey: PUBLISHABLE_KEY });
  });

  it('accepts a local http URL for local development', () => {
    const config = resolveSupabasePublicConfig(
      env({ EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321' }),
    );
    expect(config.supabaseUrl).toBe('http://localhost:54321');
  });

  it('fails clearly when the URL is missing', () => {
    expect(() => resolveSupabasePublicConfig(env({ EXPO_PUBLIC_SUPABASE_URL: undefined }))).toThrow(
      /EXPO_PUBLIC_SUPABASE_URL is missing or empty/,
    );
  });

  it('fails clearly when the anon key is an empty string', () => {
    expect(() =>
      resolveSupabasePublicConfig(env({ EXPO_PUBLIC_SUPABASE_ANON_KEY: '   ' })),
    ).toThrow(/EXPO_PUBLIC_SUPABASE_ANON_KEY is missing or empty/);
  });

  it('detects dotenvx ciphertext that Expo would inline verbatim', () => {
    expect(() =>
      resolveSupabasePublicConfig(
        env({ EXPO_PUBLIC_SUPABASE_URL: 'encrypted:BMQFFZXkJRdn0eTB2IflOEgXf4h' }),
      ),
    ).toThrow(/dotenvx-encrypted value/);
  });

  it('detects stray quotes around the URL', () => {
    expect(() =>
      resolveSupabasePublicConfig(env({ EXPO_PUBLIC_SUPABASE_URL: `"${VALID_URL}"` })),
    ).toThrow(/surrounding quotes/);
  });

  it('rejects a non-URL value without echoing it', () => {
    expect(() =>
      resolveSupabasePublicConfig(env({ EXPO_PUBLIC_SUPABASE_URL: 'not-a-url-at-all' })),
    ).toThrow(/must begin with https:\/\//);
    try {
      resolveSupabasePublicConfig(env({ EXPO_PUBLIC_SUPABASE_URL: 'not-a-url-at-all' }));
    } catch (error) {
      expect(String(error)).not.toContain('not-a-url-at-all');
    }
  });

  it('rejects secret keys so server credentials never ship in the app', () => {
    expect(() =>
      resolveSupabasePublicConfig(env({ EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_example123' })),
    ).toThrow(/secret key/);
  });

  it('rejects a legacy service-role JWT', () => {
    expect(() =>
      resolveSupabasePublicConfig(
        env({ EXPO_PUBLIC_SUPABASE_ANON_KEY: legacyJwt('service_role') }),
      ),
    ).toThrow(/service_role JWT/);
  });

  it('accepts a legacy anon JWT', () => {
    const key = legacyJwt('anon');
    expect(
      resolveSupabasePublicConfig(env({ EXPO_PUBLIC_SUPABASE_ANON_KEY: key })).supabaseAnonKey,
    ).toBe(key);
  });
});
