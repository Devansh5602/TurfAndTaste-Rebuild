import {
  ADD_ON_KEYS,
  BOOKING_DURATION_HOURS,
  FACILITY_KEYS,
  type AddOnKey,
  type BookingDurationHours,
  type FacilityKey,
} from '@turf-and-taste/types';
import { z } from 'zod';

export const facilityKeySchema = z.enum(FACILITY_KEYS);

export const addOnKeySchema = z.enum(ADD_ON_KEYS);

export const bookingDurationHoursSchema = z.union([
  z.literal(BOOKING_DURATION_HOURS[0]),
  z.literal(BOOKING_DURATION_HOURS[1]),
]);

export const businessDateSchema = z.iso.date();
export const businessTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

export const availabilityRequestSchema = z.object({
  facilityKey: facilityKeySchema,
  date: businessDateSchema,
  durationHours: bookingDurationHoursSchema,
  addOnKey: addOnKeySchema.optional(),
});

export const quoteSelectionSchema = availabilityRequestSchema.extend({
  startTime: businessTimeSchema,
});

export const createBookingSchema = quoteSelectionSchema.extend({
  quoteId: z.uuid(),
});

export const bookingIdSchema = z.uuid();

export const bookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
]);

export const UNAUTHORIZED_SPORTS = [
  'football',
  'tennis',
  'padel',
  'badminton',
  'basketball',
  'squash',
  'golf',
] as const;

export function allowsShootingMachine(facilityKey: FacilityKey): boolean {
  return facilityKey === 'cricket-green-net';
}

export function assertAddOnAllowed(facilityKey: FacilityKey, addOnKey: AddOnKey): boolean {
  if (addOnKey === 'shooting-machine') {
    return allowsShootingMachine(facilityKey);
  }
  return false;
}

export interface QuoteSelection {
  facilityKey: FacilityKey;
  date: string;
  startTime: string;
  durationHours: BookingDurationHours;
  addOnKey?: AddOnKey;
}

export function quoteMatchesSelection(quote: QuoteSelection, selection: QuoteSelection): boolean {
  return (
    quote.facilityKey === selection.facilityKey &&
    quote.date === selection.date &&
    quote.startTime === selection.startTime &&
    quote.durationHours === selection.durationHours &&
    quote.addOnKey === selection.addOnKey
  );
}

export function isPastSlot(slotStart: Date, now: Date): boolean {
  return slotStart.getTime() < now.getTime();
}

export const paymentOrderStatusSchema = z.enum([
  'created',
  'paid',
  'failed',
  'expired',
  'refunded',
]);

export const paymentStatusSchema = z.enum([
  'captured',
  'failed',
  'refunded',
]);

export const createPaymentOrderSchema = z.object({
  // The server derives the payable amount from the booking's quoted total.
  // The client only identifies which pending booking it wants to pay for.
  bookingId: z.uuid(),
});

export const verifyPaymentSchema = z.object({
  providerOrderId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

export const razorpayKeyResponseSchema = z.object({
  keyId: z.string().min(1),
});

export interface PaymentOrder {
  id: string;
  bookingId: string;
  provider: 'razorpay';
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  status: z.infer<typeof paymentOrderStatusSchema>;
  createdAt: string;
}

export interface Payment {
  id: string;
  paymentOrderId: string;
  provider: 'razorpay';
  providerPaymentId: string;
  status: z.infer<typeof paymentStatusSchema>;
  verifiedAt: string | null;
  createdAt: string;
}

export interface CreatePaymentOrderInput {
  bookingId: string;
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}
