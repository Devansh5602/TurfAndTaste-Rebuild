import { ApiClientError } from '@turf-and-taste/api-client';
import { bookingErrorView } from './bookingError';

describe('bookingErrorView', () => {
  it.each([
    [new ApiClientError('hidden', 401, 'UNAUTHENTICATED'), 'AUTH_ERROR'],
    [new ApiClientError('hidden', 409, 'QUOTE_EXPIRED'), 'QUOTE_EXPIRED'],
    [new ApiClientError('hidden', 409, 'SLOT_CONFLICT'), 'SLOT_CONFLICT'],
    [new ApiClientError('hidden', 400, 'VALIDATION_ERROR'), 'INVALID_REQUEST'],
    [new ApiClientError('hidden', 500, 'DATABASE_ERROR'), 'SERVER_ERROR'],
    [new TypeError('Network request failed'), 'NETWORK_ERROR'],
    [new Error('The API is not configured.'), 'CONFIGURATION_ERROR'],
  ])('classifies a booking failure safely', (error, classification) => {
    const result = bookingErrorView(error);
    expect(result.classification).toBe(classification);
    expect(result.description).not.toContain('hidden');
  });
});
