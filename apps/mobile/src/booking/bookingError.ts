import { ApiClientError } from '@turf-and-taste/api-client';

export type BookingFailureClass =
  | 'AUTH_ERROR'
  | 'QUOTE_EXPIRED'
  | 'SLOT_CONFLICT'
  | 'INVALID_REQUEST'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'CONFIGURATION_ERROR';

export interface BookingErrorView {
  classification: BookingFailureClass;
  title: string;
  description: string;
}

export function bookingErrorView(error: unknown): BookingErrorView {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.status === 403) {
      return view(
        'AUTH_ERROR',
        'Sign in again',
        'Your session has expired. Sign in and try again.',
      );
    }
    if (error.code === 'QUOTE_EXPIRED' || error.code === 'QUOTE_CONSUMED') {
      return view('QUOTE_EXPIRED', 'Quote expired', 'Refresh the server quote before booking.');
    }
    if (error.code === 'SLOT_CONFLICT' || error.code === 'SLOT_UNAVAILABLE') {
      return view(
        'SLOT_CONFLICT',
        'Time no longer available',
        'Choose another available interval and request a new quote.',
      );
    }
    if ([400, 404, 409, 422].includes(error.status)) {
      return view(
        'INVALID_REQUEST',
        'Check your selection',
        'This booking selection is no longer valid. Review it and try again.',
      );
    }
    if (error.status >= 500) {
      return view(
        'SERVER_ERROR',
        'Booking service unavailable',
        'The booking service could not finish the request. Please try again.',
      );
    }
  }
  if (error instanceof Error && /api is not configured/i.test(error.message)) {
    return view(
      'CONFIGURATION_ERROR',
      'Booking unavailable',
      'The app is not configured for booking. Contact support.',
    );
  }
  if (
    error instanceof TypeError ||
    (error instanceof Error && /network|fetch|connection/i.test(error.message))
  ) {
    return view(
      'NETWORK_ERROR',
      'Connection problem',
      'Check your internet connection and try again.',
    );
  }
  return view(
    'INVALID_REQUEST',
    'Check your selection',
    error instanceof Error ? error.message : 'Unable to create this booking.',
  );
}

function view(
  classification: BookingFailureClass,
  title: string,
  description: string,
): BookingErrorView {
  return { classification, title, description };
}
