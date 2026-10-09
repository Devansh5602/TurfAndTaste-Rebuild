import { ApiClientError } from '@turf-and-taste/api-client';
import {
  availabilityErrorView,
  classifyAvailabilityError,
  describeAvailabilityErrorForDevLogs,
} from './availabilityError';

describe('classifyAvailabilityError', () => {
  it('classifies 401/403 and auth codes as AUTH_ERROR', () => {
    expect(
      classifyAvailabilityError(
        new ApiClientError('Authentication required.', 401, 'UNAUTHENTICATED'),
      ),
    ).toBe('AUTH_ERROR');
    expect(classifyAvailabilityError(new ApiClientError('Forbidden.', 403, 'INVALID_DOMAIN'))).toBe(
      'AUTH_ERROR',
    );
    expect(classifyAvailabilityError(new ApiClientError('Gone.', 410, 'SESSION_EXPIRED'))).toBe(
      'AUTH_ERROR',
    );
  });

  it('classifies validation-shaped statuses as INVALID_REQUEST', () => {
    expect(
      classifyAvailabilityError(new ApiClientError('Bad request.', 400, 'VALIDATION_ERROR')),
    ).toBe('INVALID_REQUEST');
    expect(
      classifyAvailabilityError(new ApiClientError('Unknown facility.', 404, 'NOT_FOUND')),
    ).toBe('INVALID_REQUEST');
    expect(
      classifyAvailabilityError(new ApiClientError('Unprocessable.', 422, 'VALIDATION_ERROR')),
    ).toBe('INVALID_REQUEST');
  });

  it('classifies server and unclassified failures as SERVER_ERROR', () => {
    expect(
      classifyAvailabilityError(new ApiClientError('Database error.', 500, 'DATABASE_ERROR')),
    ).toBe('SERVER_ERROR');
    expect(classifyAvailabilityError(new ApiClientError('Slow down.', 429, 'RATE_LIMITED'))).toBe(
      'SERVER_ERROR',
    );
  });

  it('classifies the client configuration guard as CONFIGURATION_ERROR', () => {
    expect(classifyAvailabilityError(new Error('The API is not configured.'))).toBe(
      'CONFIGURATION_ERROR',
    );
  });

  it('classifies the client session guard as AUTH_ERROR', () => {
    expect(
      classifyAvailabilityError(new Error('Your session has expired. Please sign in again.')),
    ).toBe('AUTH_ERROR');
  });

  it('classifies transport failures as NETWORK_ERROR', () => {
    expect(classifyAvailabilityError(new TypeError('Network request failed'))).toBe(
      'NETWORK_ERROR',
    );
    expect(classifyAvailabilityError(undefined)).toBe('NETWORK_ERROR');
  });
});

describe('availabilityErrorView', () => {
  it('offers retry for network, auth, server and validation failures only', () => {
    expect(availabilityErrorView(new TypeError('Network request failed')).canRetry).toBe(true);
    expect(availabilityErrorView(new ApiClientError('x', 401, 'UNAUTHENTICATED')).canRetry).toBe(
      true,
    );
    expect(availabilityErrorView(new ApiClientError('x', 500, 'DATABASE_ERROR')).canRetry).toBe(
      true,
    );
    expect(availabilityErrorView(new Error('The API is not configured.')).canRetry).toBe(false);
  });

  it('never uses connectivity wording for configuration or auth problems', () => {
    expect(availabilityErrorView(new Error('The API is not configured.')).description).not.toMatch(
      /connection|internet/i,
    );
    expect(
      availabilityErrorView(new ApiClientError('Authentication required.', 401, 'UNAUTHENTICATED'))
        .description,
    ).not.toMatch(/connection|internet/i);
  });
});

describe('describeAvailabilityErrorForDevLogs', () => {
  it('includes category and status but never the raw token material', () => {
    const error = new ApiClientError(
      'Authorization: Bearer secret-token-material',
      401,
      'UNAUTHENTICATED',
    );
    const line = describeAvailabilityErrorForDevLogs(error);
    expect(line).toContain('category=AUTH_ERROR');
    expect(line).toContain('status=401');
    expect(line).not.toContain('secret-token-material');
    expect(line).not.toContain('Bearer');
  });
});
