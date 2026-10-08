/**
 * Maps raw Supabase/Auth-js errors to short, user-safe messages.
 *
 * Customers never see raw GoTrue internals or stack traces; full technical
 * detail is preserved separately as development-only diagnostics. Credential
 * material (passwords, tokens) must never be passed to these helpers.
 */

export type AuthAction = 'signIn' | 'signUp' | 'resetPassword' | 'resendVerification';

const FALLBACK_MESSAGES: Record<AuthAction, string> = {
  signIn: 'Unable to sign in. Please try again.',
  signUp: 'Unable to create your account. Please try again.',
  resetPassword: 'Unable to send the reset email. Please try again.',
  resendVerification: 'Unable to send the verification email. Please try again.',
};

interface ErrorShape {
  message: string;
  code: string;
  name: string;
}

function readError(error: unknown): ErrorShape {
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; code?: unknown; name?: unknown };
    return {
      message: typeof candidate.message === 'string' ? candidate.message : '',
      code: typeof candidate.code === 'string' ? candidate.code : '',
      name: typeof candidate.name === 'string' ? candidate.name : '',
    };
  }
  return { message: typeof error === 'string' ? error : '', code: '', name: '' };
}

export function isNetworkError(error: unknown): boolean {
  const { message, name } = readError(error);
  if (name === 'AuthRetryableFetchError' || name === 'TypeError') return true;
  return /network request failed|failed to fetch|fetch failed|network error|load failed/i.test(
    message,
  );
}

/**
 * Returns a safe, actionable message for an auth failure.
 *
 * Known GoTrue codes get specific copy; everything else falls back to a
 * generic per-action message so no internal detail can leak to customers.
 */
export function toFriendlyAuthError(action: AuthAction, error: unknown): string {
  const { message, code } = readError(error);
  const lower = message.toLowerCase();

  if (isNetworkError(error)) {
    return 'Network unavailable. Please check your connection and try again.';
  }

  if (code === 'invalid_credentials' || code === 'user_not_found') {
    return action === 'signIn' ? 'Invalid email or password' : FALLBACK_MESSAGES[action];
  }
  if (lower.includes('invalid login credentials')) {
    return 'Invalid email or password';
  }
  if (code === 'email_not_confirmed' || lower.includes('email not confirmed')) {
    return 'Please verify your email before signing in.';
  }
  if (code === 'user_already_exists' || lower.includes('already registered')) {
    return 'Account already exists. Try signing in instead.';
  }
  if (code === 'weak_password' || lower.includes('password should be')) {
    return 'Password is too weak. Please choose a different password.';
  }
  if (
    code === 'over_email_send_rate_limit' ||
    lower.includes('rate limit') ||
    lower.includes('security purposes')
  ) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code === 'signup_disabled') {
    return 'Account creation is currently disabled.';
  }

  return FALLBACK_MESSAGES[action];
}

/**
 * Development-only technical diagnostics. Only the error code/message from
 * GoTrue are logged — never passwords, tokens, or e-mail addresses.
 */
export function logAuthDiagnostics(scope: string, error: unknown): void {
  if (process.env.NODE_ENV === 'production') return;
  const { code, name } = readError(error);
  // Development diagnostics only: code/name carry no credentials or tokens.
  // eslint-disable-next-line no-console
  console.warn(`[auth] ${scope} failed`, { code, name });
}
