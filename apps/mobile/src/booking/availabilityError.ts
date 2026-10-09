import { ApiClientError } from '@turf-and-taste/api-client';

export type AvailabilityErrorCategory =
  'NETWORK_ERROR' | 'AUTH_ERROR' | 'SERVER_ERROR' | 'CONFIGURATION_ERROR' | 'INVALID_REQUEST';

export interface AvailabilityErrorView {
  title: string;
  description: string;
  canRetry: boolean;
}

const AUTH_CODES = new Set([
  'UNAUTHENTICATED',
  'INVALID_TOKEN',
  'INVALID_DOMAIN',
  'SESSION_EXPIRED',
  'FORBIDDEN',
]);

/**
 * Maps an availability request failure to a safe, classified user-facing state.
 * Transport failures (fetch TypeError, DNS, TLS, abort) and the client's own
 * "no token"/"no network" guards land here; nothing in this module may include
 * tokens, headers, or raw server internals.
 */
export function classifyAvailabilityError(error: unknown): AvailabilityErrorCategory {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.status === 403 || AUTH_CODES.has(error.code)) {
      return 'AUTH_ERROR';
    }
    if (error.status === 400 || error.status === 404 || error.status === 422) {
      return 'INVALID_REQUEST';
    }
    return 'SERVER_ERROR';
  }
  if (error instanceof Error) {
    if (error.message === 'The API is not configured.') return 'CONFIGURATION_ERROR';
    if (error.message.startsWith('Your session has expired')) return 'AUTH_ERROR';
  }
  return 'NETWORK_ERROR';
}

const VIEWS: Record<AvailabilityErrorCategory, AvailabilityErrorView> = {
  NETWORK_ERROR: {
    title: 'Cannot reach the service',
    description: 'Check your internet connection and try again.',
    canRetry: true,
  },
  AUTH_ERROR: {
    title: 'Your session has expired',
    description: 'Please sign in again to see available times.',
    canRetry: true,
  },
  SERVER_ERROR: {
    title: 'Something went wrong',
    description: 'The service is temporarily unavailable. Please try again shortly.',
    canRetry: true,
  },
  CONFIGURATION_ERROR: {
    title: 'Booking is not set up yet',
    description:
      'This build is missing its API configuration. A developer must check the app environment.',
    canRetry: false,
  },
  INVALID_REQUEST: {
    title: 'This selection cannot be booked',
    description: 'Choose a valid facility, date, and duration, then try again.',
    canRetry: true,
  },
};

export function availabilityErrorView(error: unknown): AvailabilityErrorView {
  return VIEWS[classifyAvailabilityError(error)];
}

/** Development-only diagnostic line; category/code/status only — never tokens or headers. */
export function describeAvailabilityErrorForDevLogs(error: unknown): string {
  const category = classifyAvailabilityError(error);
  if (error instanceof ApiClientError) {
    return `availability request failed: category=${category} status=${error.status} code=${error.code}`;
  }
  if (error instanceof Error) {
    return `availability request failed: category=${category} reason=${error.message}`;
  }
  return `availability request failed: category=${category} reason=unknown`;
}
