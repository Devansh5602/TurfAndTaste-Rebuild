import { isNetworkError, logAuthDiagnostics, toFriendlyAuthError } from './authErrors';

function authError(message: string, code?: string, name = 'AuthApiError'): Error {
  const error = new Error(message);
  error.name = name;
  if (code !== undefined) {
    (error as Error & { code?: string }).code = code;
  }
  return error;
}

describe('toFriendlyAuthError', () => {
  it('maps invalid credentials to a safe sign-in message', () => {
    expect(
      toFriendlyAuthError('signIn', authError('Invalid login credentials', 'invalid_credentials')),
    ).toBe('Invalid email or password');
  });

  it('maps unverified e-mail to a verification message', () => {
    expect(
      toFriendlyAuthError('signIn', authError('Email not confirmed', 'email_not_confirmed')),
    ).toBe('Please verify your email before signing in.');
  });

  it('maps existing-account registration failures', () => {
    expect(
      toFriendlyAuthError('signUp', authError('User already registered', 'user_already_exists')),
    ).toBe('Account already exists. Try signing in instead.');
    expect(toFriendlyAuthError('signUp', authError('User already registered'))).toBe(
      'Account already exists. Try signing in instead.',
    );
  });

  it('maps network failures for every action', () => {
    const network = new TypeError('Network request failed');
    expect(toFriendlyAuthError('signIn', network)).toBe(
      'Network unavailable. Please check your connection and try again.',
    );
    expect(toFriendlyAuthError('signUp', network)).toBe(
      'Network unavailable. Please check your connection and try again.',
    );
    expect(
      toFriendlyAuthError(
        'resetPassword',
        authError('TypeError: Failed to fetch', undefined, 'AuthRetryableFetchError'),
      ),
    ).toBe('Network unavailable. Please check your connection and try again.');
  });

  it('maps rate limits to a wait-and-retry message', () => {
    expect(
      toFriendlyAuthError(
        'resetPassword',
        authError(
          'For security purposes, you can only request this after 60 seconds.',
          'over_email_send_rate_limit',
        ),
      ),
    ).toBe('Too many attempts. Please wait a moment and try again.');
  });

  it('maps weak passwords without echoing server internals', () => {
    expect(
      toFriendlyAuthError(
        'signUp',
        authError('Password should be at least 8 characters.', 'weak_password'),
      ),
    ).toBe('Password is too weak. Please choose a different password.');
  });

  it('falls back to a generic per-action message for unknown errors', () => {
    const unknown = authError('AuthApiError: some internal detail xyz', 'unexpected_failure');
    expect(toFriendlyAuthError('signIn', unknown)).toBe('Unable to sign in. Please try again.');
    expect(toFriendlyAuthError('signUp', unknown)).toBe(
      'Unable to create your account. Please try again.',
    );
    expect(toFriendlyAuthError('resetPassword', unknown)).toBe(
      'Unable to send the reset email. Please try again.',
    );
    expect(toFriendlyAuthError('resendVerification', unknown)).toBe(
      'Unable to send the verification email. Please try again.',
    );
    // Raw internals never reach the customer-facing message.
    expect(toFriendlyAuthError('signIn', unknown)).not.toContain('internal detail');
    expect(toFriendlyAuthError('signIn', unknown)).not.toContain('AuthApiError');
  });

  it('handles non-error inputs without throwing', () => {
    expect(toFriendlyAuthError('signIn', undefined)).toBe('Unable to sign in. Please try again.');
    expect(toFriendlyAuthError('signIn', 'boom')).toBe('Unable to sign in. Please try again.');
  });
});

describe('isNetworkError', () => {
  it('detects fetch and network failures', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(authError('x', undefined, 'AuthRetryableFetchError'))).toBe(true);
    expect(isNetworkError(authError('Invalid login credentials', 'invalid_credentials'))).toBe(
      false,
    );
  });
});

describe('logAuthDiagnostics', () => {
  it('logs only code and name, never the raw message payload', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    logAuthDiagnostics('signIn', authError('raw detail', 'invalid_credentials'));
    expect(warn).toHaveBeenCalledTimes(1);
    const [scope, detail] = warn.mock.calls[0] as [string, { code: string; name: string }];
    expect(scope).toBe('[auth] signIn failed');
    expect(detail.code).toBe('invalid_credentials');
    expect(JSON.stringify(detail)).not.toContain('raw detail');
    warn.mockRestore();
  });
});
