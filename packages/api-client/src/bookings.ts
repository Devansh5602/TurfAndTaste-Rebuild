import type { AddOnKey, BookingDurationHours, FacilityKey } from '@turf-and-taste/types';
import { authenticatedRequest, ApiClientError } from './client';

export interface AvailabilitySlot {
  startTime: string;
  startsAt: string;
  endsAt: string;
  validEndsAt: string[];
}

export interface AvailabilityListing {
  serverNow: string;
  businessTimeZone: 'Asia/Kolkata';
  date: string;
  durationHours: BookingDurationHours;
  slots: AvailabilitySlot[];
}

export interface QuoteSelection {
  facilityKey: FacilityKey;
  date: string;
  startTime: string;
  durationHours: BookingDurationHours;
  addOnKey?: AddOnKey;
}

export interface BookingQuote extends QuoteSelection {
  id: string;
  facilityId: string;
  addonKey?: AddOnKey;
  addonId?: string;
  startsAt: string;
  endsAt: string;
  priceComponents: Array<{
    startsAt: string;
    endsAt: string;
    amountPaise: number;
    currency: string;
    pricingTierId: string;
  }>;
  amountPaise: number;
  currency: string;
  expiresAt: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface BookingItem {
  id: string;
  bookingId: string;
  facilityId: string;
  facilityKey: FacilityKey;
  facilityName: string;
  addonId: string | null;
  addonKey: AddOnKey | null;
  addonName: string | null;
  amountPaise: number;
}

export interface Booking {
  id: string;
  customerProfileId: string;
  status: BookingStatus;
  startsAt: string;
  durationHours: BookingDurationHours;
  quotedAmountPaise: number;
  currency: string;
  quoteExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  items: BookingItem[];
}

export async function getAvailability(
  baseUrl: string,
  accessToken: string,
  input: Omit<QuoteSelection, 'startTime'>,
): Promise<AvailabilityListing> {
  const query = new URLSearchParams({
    date: input.date,
    durationHours: String(input.durationHours),
  });
  if (input.addOnKey) query.set('addOnKey', input.addOnKey);
  return authenticatedRequest<AvailabilityListing>(
    baseUrl,
    `/api/v1/facilities/${input.facilityKey}/availability?${query.toString()}`,
    accessToken,
  );
}

export async function createQuote(
  baseUrl: string,
  accessToken: string,
  input: QuoteSelection,
): Promise<BookingQuote> {
  return authenticatedRequest<BookingQuote>(baseUrl, '/api/v1/bookings/quotes', accessToken, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function createBooking(
  baseUrl: string,
  accessToken: string,
  input: QuoteSelection & { quoteId: string },
): Promise<Booking> {
  return authenticatedRequest<Booking>(baseUrl, '/api/v1/bookings', accessToken, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getBookings(
  baseUrl: string,
  accessToken: string,
  status?: BookingStatus,
): Promise<Booking[]> {
  const query = status ? `?status=${status}` : '';
  return authenticatedRequest<Booking[]>(baseUrl, `/api/v1/bookings${query}`, accessToken);
}

export async function getBooking(
  baseUrl: string,
  accessToken: string,
  bookingId: string,
): Promise<Booking> {
  return authenticatedRequest<Booking>(baseUrl, `/api/v1/bookings/${bookingId}`, accessToken);
}

export interface PaymentOrder {
  id: string;
  bookingId: string;
  provider: 'razorpay';
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  status: 'created' | 'paid' | 'failed' | 'expired' | 'refunded';
  createdAt: string;
}

export interface Payment {
  id: string;
  paymentOrderId: string;
  provider: 'razorpay';
  providerPaymentId: string;
  status: 'captured' | 'failed' | 'refunded';
  verifiedAt: string | null;
  createdAt: string;
}

export interface RazorpayKeyResponse {
  keyId: string;
}

export async function createPaymentOrder(
  baseUrl: string,
  accessToken: string,
  bookingId: string,
): Promise<PaymentOrder> {
  return authenticatedRequest<PaymentOrder>(baseUrl, '/api/v1/payments/orders', accessToken, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bookingId }),
  });
}

export async function getPaymentOrder(
  baseUrl: string,
  accessToken: string,
  bookingId: string,
): Promise<PaymentOrder | null> {
  try {
    return await authenticatedRequest<PaymentOrder>(
      baseUrl,
      `/api/v1/payments/orders/booking/${bookingId}`,
      accessToken,
    );
  } catch (error: unknown) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function verifyPayment(
  baseUrl: string,
  accessToken: string,
  input: { providerOrderId: string; providerPaymentId: string; signature: string },
): Promise<Payment> {
  return authenticatedRequest<Payment>(baseUrl, '/api/v1/payments/verify', accessToken, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getRazorpayKeyId(baseUrl: string, accessToken: string): Promise<string> {
  const response = await authenticatedRequest<RazorpayKeyResponse>(
    baseUrl,
    '/api/v1/payments/razorpay/key',
    accessToken,
  );
  return response.keyId;
}
