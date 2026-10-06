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
