import type { SupabaseClient, Session } from '@supabase/supabase-js';
import {
  establishAuthCallbackSession,
  isAuthCallbackUrl,
  MOBILE_AUTH_CALLBACK_URL,
  MOBILE_RESET_REDIRECT_URL,
  parseAuthCallbackUrl,
  VERIFICATION_FAILED_TITLE,
  VERIFICATION_LINK_INVALID_TITLE,
} from './authCallback';
import { NETWORK_UNAVAILABLE_MESSAGE, VERIFICATION_LINK_INVALID_MESSAGE } from './authErrors';

const user = { id: 'user-1', email: 'person@example.com' } as unknown as Session['user'];
const session = {
  access_token: 'server-issued-access-token',
  refresh_token: 'server-issued-refresh-token',
  expires_at: 9_999_999_999,
  token_type: 'bearer',
  user,
} as unknown as Session;

function authError(message: string, code?: string, name = 'AuthApiError'): Error {
  const error = new Error(message);
  error.name = name;
  if (code !== undefined) {
    (error as Error & { code?: string }).code = code;
  }
  return error;
}

interface ClientMock {
  auth: {
    getSession: jest.Mock;
    setSession: jest.Mock;
    exchangeCodeForSession: jest.Mock;
  };
}

function makeClient(overrides: Partial<ClientMock['auth']> = {}): {
  client: SupabaseClient;
  auth: ClientMock['auth'];
} {
  const auth = {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    setSession: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    exchangeCodeForSession: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    ...overrides,
  };
  return { client: { auth } as unknown as SupabaseClient, auth };
}

describe('canonical redirect targets', () => {
  it('uses turfandtaste://auth/callback as the confirmation callback', () => {
    expect(MOBILE_AUTH_CALLBACK_URL).toBe('turfandtaste://auth/callback');
  });

  it('derives both redirect targets from the Expo scheme in app.json', () => {
    const appJson = jest.requireActual<{ expo: { scheme: string } }>('../../app.json');
    const scheme = appJson.expo.scheme;
    expect(scheme).toBe('turfandtaste');
    expect(MOBILE_AUTH_CALLBACK_URL.startsWith(`${scheme}://`)).toBe(true);
    expect(MOBILE_RESET_REDIRECT_URL.startsWith(`${scheme}://`)).toBe(true);
  });
});

describe('isAuthCallbackUrl', () => {
  it('accepts the canonical callback with query, hash, or trailing slash', () => {
    expect(isAuthCallbackUrl(MOBILE_AUTH_CALLBACK_URL)).toBe(true);
    expect(isAuthCallbackUrl(`${MOBILE_AUTH_CALLBACK_URL}?email=a@b.c`)).toBe(true);
    expect(isAuthCallbackUrl(`${MOBILE_AUTH_CALLBACK_URL}#access_token=x&refresh_token=y`)).toBe(
      true,
    );
    expect(isAuthCallbackUrl('turfandtaste://auth/callback/')).toBe(true);
  });

  it('rejects other schemes and near-miss paths', () => {
    expect(isAuthCallbackUrl('https://example.com/auth/callback')).toBe(false);
    expect(isAuthCallbackUrl('turfandtaste://reset-password#x')).toBe(false);
    expect(isAuthCallbackUrl('turfandtaste://auth/callbackx')).toBe(false);
    expect(isAuthCallbackUrl('turfandtaste://auth/callback/extra')).toBe(false);
    expect(isAuthCallbackUrl('')).toBe(false);
  });
});

describe('parseAuthCallbackUrl', () => {
  it('parses the implicit-flow token pair from the hash', () => {
    const result = parseAuthCallbackUrl(
      'turfandtaste://auth/callback#access_token=abc123&refresh_token=def456&token_type=bearer',
    );
    expect(result).toEqual({ kind: 'tokens', accessToken: 'abc123', refreshToken: 'def456' });
  });

  it('parses tokens from the query when an intermediary moved them', () => {
    const result = parseAuthCallbackUrl(
      'turfandtaste://auth/callback?access_token=abc123&refresh_token=def456',
    );
    expect(result).toEqual({ kind: 'tokens', accessToken: 'abc123', refreshToken: 'def456' });
  });

  it('parses a PKCE code', () => {
    expect(parseAuthCallbackUrl('turfandtaste://auth/callback?code=pkce-code-1')).toEqual({
      kind: 'code',
      code: 'pkce-code-1',
    });
  });

  it("parses GoTrue's otp_expired error redirect into an error result", () => {
    const result = parseAuthCallbackUrl(
      'turfandtaste://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(result).toEqual({ kind: 'error', errorCode: 'otp_expired' });
  });

  it('parses error redirects moved to the query by intermediaries', () => {
    const result = parseAuthCallbackUrl(
      'turfandtaste://auth/callback?error=access_denied&error_code=otp_expired',
    );
    expect(result).toEqual({ kind: 'error', errorCode: 'otp_expired' });
  });

  it('rejects a bare callback, mangled encoding, and partial token pairs', () => {
    expect(parseAuthCallbackUrl('turfandtaste://auth/callback')).toEqual({ kind: 'malformed' });
    expect(parseAuthCallbackUrl('turfandtaste://auth/callback?broken=%E0%A4%A')).toEqual({
      kind: 'malformed',
    });
    expect(parseAuthCallbackUrl('turfandtaste://auth/callback#access_token=only-half')).toEqual({
      kind: 'malformed',
    });
    expect(
      parseAuthCallbackUrl('turfandtaste://reset-password#access_token=a&refresh_token=b'),
    ).toEqual({ kind: 'malformed' });
  });
});

describe('establishAuthCallbackSession', () => {
  beforeEach(() => {
    // Development diagnostics log code/name only; keep test output clean.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('establishes the session from an implicit token pair', async () => {
    const { client, auth } = makeClient();

    const outcome = await establishAuthCallbackSession(
      client,
      'turfandtaste://auth/callback#access_token=abc123&refresh_token=def456',
    );

    expect(outcome).toEqual({ status: 'session', session });
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: 'abc123',
      refresh_token: 'def456',
    });
  });

  it('exchanges a PKCE code for the session', async () => {
    const { client, auth } = makeClient();

    const outcome = await establishAuthCallbackSession(
      client,
      'turfandtaste://auth/callback?code=pkce-code-1',
    );

    expect(outcome).toEqual({ status: 'session', session });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code-1');
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('maps an expired confirmation redirect to the recoverable invalid state', async () => {
    const { client, auth } = makeClient();

    const outcome = await establishAuthCallbackSession(
      client,
      'turfandtaste://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );

    expect(outcome).toEqual({
      status: 'invalid',
      title: VERIFICATION_LINK_INVALID_TITLE,
      message: VERIFICATION_LINK_INVALID_MESSAGE,
    });
    // No token exchange is attempted for a link GoTrue already rejected.
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('treats a malformed callback as invalid without calling Supabase auth', async () => {
    const { client, auth } = makeClient();

    const outcome = await establishAuthCallbackSession(client, 'turfandtaste://auth/callback');

    expect(outcome).toEqual({
      status: 'invalid',
      title: VERIFICATION_LINK_INVALID_TITLE,
      message: VERIFICATION_LINK_INVALID_MESSAGE,
    });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('maps a rejected token exchange to safe copy without leaking internals', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client } = makeClient({
      setSession: jest
        .fn()
        .mockResolvedValue({ data: { session: null }, error: authError('JWT expired', 'bad_jwt') }),
    });

    const outcome = await establishAuthCallbackSession(
      client,
      'turfandtaste://auth/callback#access_token=stale&refresh_token=stale',
    );

    expect(outcome).toEqual({
      status: 'invalid',
      title: VERIFICATION_LINK_INVALID_TITLE,
      message: VERIFICATION_LINK_INVALID_MESSAGE,
    });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain('JWT expired');
    warn.mockRestore();
  });

  it('maps network failures during exchange to the network state', async () => {
    const { client } = makeClient({
      setSession: jest.fn().mockRejectedValue(new TypeError('Network request failed')),
    });

    const outcome = await establishAuthCallbackSession(
      client,
      'turfandtaste://auth/callback#access_token=abc&refresh_token=def',
    );

    expect(outcome).toEqual({
      status: 'invalid',
      title: VERIFICATION_FAILED_TITLE,
      message: NETWORK_UNAVAILABLE_MESSAGE,
    });
  });

  it('ignores callbacks that arrive while a session already exists', async () => {
    const { client, auth } = makeClient({
      getSession: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    });

    const outcome = await establishAuthCallbackSession(
      client,
      'turfandtaste://auth/callback#error=access_denied&error_code=otp_expired',
    );

    expect(outcome).toEqual({ status: 'ignored' });
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('ignores URLs that are not the app callback without touching auth', async () => {
    const { client, auth } = makeClient();

    const outcome = await establishAuthCallbackSession(
      client,
      'turfandtaste://reset-password#access_token=a&refresh_token=b',
    );

    expect(outcome).toEqual({ status: 'ignored' });
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it('never logs token values on success or failure', async () => {
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    const secretToken = 'SECRET-TOKEN-VALUE-DO-NOT-LOG';

    const ok = makeClient();
    await establishAuthCallbackSession(
      ok.client,
      `turfandtaste://auth/callback#access_token=${secretToken}&refresh_token=${secretToken}`,
    );

    const failing = makeClient({
      setSession: jest
        .fn()
        .mockResolvedValue({ data: { session: null }, error: authError('boom', 'bad_jwt') }),
    });
    await establishAuthCallbackSession(
      failing.client,
      `turfandtaste://auth/callback#access_token=${secretToken}&refresh_token=${secretToken}`,
    );

    const logged = spies.flatMap((spy) => spy.mock.calls).map((call) => JSON.stringify(call));
    expect(logged.join('\n')).not.toContain(secretToken);
    spies.forEach((spy) => spy.mockRestore());
  });
});
