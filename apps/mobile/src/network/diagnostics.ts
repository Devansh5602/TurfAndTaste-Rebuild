import { ApiClientError } from '@turf-and-taste/api-client';

export type MobileOperation =
  | 'home.facilities'
  | 'facility.detail'
  | 'facility.pricing'
  | 'facility.schedule'
  | 'booking.availability'
  | 'booking.quote'
  | 'booking.create'
  | 'booking.detail'
  | 'bookings.list';

function classify(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.status === 403) return 'AUTH_ERROR';
    if (error.code === 'QUOTE_EXPIRED') return 'QUOTE_EXPIRED';
    if (error.code === 'SLOT_CONFLICT' || error.code === 'SLOT_UNAVAILABLE') return 'SLOT_CONFLICT';
    if ([400, 404, 409, 422].includes(error.status)) return 'INVALID_REQUEST';
    if (error.status >= 500) return 'SERVER_ERROR';
  }
  if (error instanceof TypeError) return 'NETWORK_ERROR';
  if (error instanceof Error && /not configured|missing api url/i.test(error.message)) {
    return 'CONFIGURATION_ERROR';
  }
  return 'UNKNOWN_ERROR';
}

/** Development-only, token-free timing for the physical app request path. */
export async function traceMobileRequest<T>(operation: MobileOperation, request: () => Promise<T>) {
  const startedAt = Date.now();
  if (__DEV__) {
    // Never add request headers, tokens, URLs with sensitive query data, or payloads here.
    // eslint-disable-next-line no-console
    console.info(`[mobile-trace] ${operation} request:start`);
  }
  try {
    const result = await request();
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info(
        `[mobile-trace] ${operation} request:finish elapsedMs=${Date.now() - startedAt} status=success`,
      );
    }
    return result;
  } catch (error) {
    if (__DEV__) {
      const status = error instanceof ApiClientError ? error.status : 'none';
      // eslint-disable-next-line no-console
      console.warn(
        `[mobile-trace] ${operation} request:finish elapsedMs=${Date.now() - startedAt} httpStatus=${status} class=${classify(error)}`,
      );
    }
    throw error;
  }
}

export function traceNavigation(transition: string) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.info(`[mobile-trace] navigation ${transition}`);
  }
}
