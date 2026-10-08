import type { SupabaseClient, Session } from '@supabase/supabase-js';
import {
  isNetworkError,
  logAuthDiagnostics,
  NETWORK_UNAVAILABLE_MESSAGE,
  VERIFICATION_LINK_INVALID_MESSAGE,
} from './authErrors';

/**
 * Canonical mobile redirect targets for Supabase e-mail links.
 *
 * Every `emailRedirectTo`/`redirectTo` the app sends must come from here so
 * there is exactly one deep-link contract between the app, the confirmation
 * e-mails, and the Supabase dashboard Redirect URL allowlist. `turfandtaste`
 * is the Expo `scheme` in app.json (registered in the Android/iOS manifest
 * since the initial scaffold), so no native rebuild is needed to receive it.
 */
export const MOBILE_AUTH_CALLBACK_URL = 'turfandtaste://auth/callback';
export const MOBILE_RESET_REDIRECT_URL = 'turfandtaste://reset-password';

/** Title for the recoverable state shown when a confirmation link fails. */
export const VERIFICATION_LINK_INVALID_TITLE = 'Verification link expired or invalid';
/** Title when the callback itself could not be completed (e.g. offline). */
export const VERIFICATION_FAILED_TITLE = 'Unable to complete verification';
export const GENERIC_RETRY_MESSAGE = 'Something went wrong. Please try again.';

export type AuthCallbackParseResult =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'error'; errorCode: string | null }
  | { kind: 'malformed' };

export type AuthCallbackOutcome =
  | { status: 'session'; session: Session }
  | { status: 'invalid'; title: string; message: string }
  | { status: 'ignored' };

/** True when `url` is this app's canonical confirmation callback. */
export function isAuthCallbackUrl(url: string): boolean {
  const scheme = 'turfandtaste://';
  if (!url.startsWith(scheme)) return false;
  const rest = url.slice(scheme.length);
  const boundary = rest.search(/[?#]/);
  const path = boundary === -1 ? rest : rest.slice(0, boundary);
  return path === 'auth/callback' || path === 'auth/callback/';
}

/**
 * Decodes one `key=value&key=value` segment. Returns null when any value is
 * not decodable — a mangled link must fail closed, never partially apply.
 */
function parseParams(segment: string): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (const pair of segment.split('&')) {
    if (pair === '') continue;
    const separator = pair.indexOf('=');
    if (separator <= 0) return null;
    const key = pair.slice(0, separator);
    const rawValue = pair.slice(separator + 1);
    try {
      params[decodeURIComponent(key)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      return null;
    }
  }
  return params;
}

/**
 * Parses a confirmation callback URL without side effects.
 *
 * Supports the implicit-flow hash payload GoTrue redirects on e-mail
 * confirmation (`#access_token=...&refresh_token=...`), the PKCE `?code=`
 * variant, GoTrue's error redirects (`#error=access_denied&error_code=...`),
 * and rejects anything else as malformed. Tokens are returned to the caller
 * and never logged.
 */
export function parseAuthCallbackUrl(url: string): AuthCallbackParseResult {
  if (!isAuthCallbackUrl(url)) return { kind: 'malformed' };

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const query =
    queryIndex === -1
      ? ''
      : url.slice(queryIndex + 1, hashIndex > queryIndex ? hashIndex : undefined);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex + 1);

  if (query === '' && hash === '') return { kind: 'malformed' };

  const hashParams = hash === '' ? {} : parseParams(hash);
  const queryParams = query === '' ? {} : parseParams(query);
  if (hashParams === null || queryParams === null) return { kind: 'malformed' };

  // GoTrue error redirects carry the failure in the hash (`error` +
  // `error_code`, e.g. access_denied/otp_expired); some intermediaries move
  // them to the query. Any error param wins over everything else.
  const errorCode =
    hashParams.error_code ??
    hashParams.error ??
    queryParams.error_code ??
    queryParams.error ??
    null;
  if (hashParams.error !== undefined || queryParams.error !== undefined || errorCode !== null) {
    return { kind: 'error', errorCode };
  }

  const accessToken = hashParams.access_token ?? queryParams.access_token;
  const refreshToken = hashParams.refresh_token ?? queryParams.refresh_token;
  if (accessToken !== undefined && refreshToken !== undefined) {
    if (accessToken === '' || refreshToken === '') return { kind: 'malformed' };
    return { kind: 'tokens', accessToken, refreshToken };
  }
  // Half a token pair is a tampered/truncated link: never exchange it.
  if (accessToken !== undefined || refreshToken !== undefined) return { kind: 'malformed' };

  const code = hashParams.code ?? queryParams.code;
  if (code !== undefined && code !== '') return { kind: 'code', code };

  return { kind: 'malformed' };
}

function invalidOutcome(): AuthCallbackOutcome {
  return {
    status: 'invalid',
    title: VERIFICATION_LINK_INVALID_TITLE,
    message: VERIFICATION_LINK_INVALID_MESSAGE,
  };
}

function failureOutcome(error: unknown): AuthCallbackOutcome {
  return isNetworkError(error)
    ? {
        status: 'invalid',
        title: VERIFICATION_FAILED_TITLE,
        message: NETWORK_UNAVAILABLE_MESSAGE,
      }
    : invalidOutcome();
}

/**
 * Completes a confirmation deep link: establishes the session Supabase
 * handed back, or reports a recoverable failure with user-safe copy.
 *
 * - Non-callback URLs are ignored (other deep links are not ours to handle).
 * - Callbacks that arrive while a session already exists are ignored: an
 *   authenticated customer is never yanked back into a verification state.
 * - Errors are mapped to safe messages; only development diagnostics
 *   (error code/name) are ever logged — never tokens or raw error text.
 */
export async function establishAuthCallbackSession(
  client: SupabaseClient,
  url: string,
): Promise<AuthCallbackOutcome> {
  if (!isAuthCallbackUrl(url)) return { status: 'ignored' };

  try {
    const {
      data: { session: existing },
    } = await client.auth.getSession();
    if (existing) return { status: 'ignored' };

    const parsed = parseAuthCallbackUrl(url);

    if (parsed.kind === 'error' || parsed.kind === 'malformed') {
      logAuthDiagnostics('emailConfirmation callback', {
        code: parsed.kind === 'error' ? (parsed.errorCode ?? 'unknown') : 'malformed_url',
      });
      return invalidOutcome();
    }

    if (parsed.kind === 'tokens') {
      const { data, error } = await client.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
      if (error) {
        logAuthDiagnostics('emailConfirmation setSession', error);
        return failureOutcome(error);
      }
      if (!data.session) return invalidOutcome();
      return { status: 'session', session: data.session };
    }

    const { data, error } = await client.auth.exchangeCodeForSession(parsed.code);
    if (error) {
      logAuthDiagnostics('emailConfirmation exchangeCodeForSession', error);
      return failureOutcome(error);
    }
    if (!data.session) return invalidOutcome();
    return { status: 'session', session: data.session };
  } catch (unexpected) {
    logAuthDiagnostics('emailConfirmation (unexpected)', unexpected);
    return failureOutcome(unexpected);
  }
}
