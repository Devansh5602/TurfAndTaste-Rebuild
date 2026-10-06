import { describe, expect, it } from 'vitest';
import {
  availabilityRequestSchema,
  businessDateTime,
  businessTimeSchema,
  businessWeekday,
  createBookingSchema,
  quoteSelectionSchema,
} from './index';

describe('booking input and business time', () => {
  it('rejects impossible dates and times', () => {
    expect(
      availabilityRequestSchema.safeParse({
        facilityKey: 'box-cricket',
        date: '2026-02-30',
        durationHours: 1,
      }).success,
    ).toBe(false);
    expect(businessTimeSchema.safeParse('24:00').success).toBe(false);
  });

  it('converts Asia/Kolkata date and time independently of the host timezone', () => {
    expect(businessDateTime('2026-10-07', '06:00').toISOString()).toBe('2026-10-07T00:30:00.000Z');
    expect(businessWeekday(businessDateTime('2026-10-11', '12:00'))).toBe(0);
  });

  it('accepts only authorized facilities and durations', () => {
    expect(
      quoteSelectionSchema.safeParse({
        facilityKey: 'cricket-green-net',
        date: '2026-10-07',
        startTime: '07:00',
        durationHours: 2,
        addOnKey: 'shooting-machine',
      }).success,
    ).toBe(true);
    expect(
      quoteSelectionSchema.safeParse({
        facilityKey: 'football',
        date: '2026-10-07',
        startTime: '07:00',
        durationHours: 1,
      }).success,
    ).toBe(false);
    expect(
      quoteSelectionSchema.safeParse({
        facilityKey: 'box-cricket',
        date: '2026-10-07',
        startTime: '07:00',
        durationHours: 3,
      }).success,
    ).toBe(false);
  });

  it('requires a real quote identifier to create a booking', () => {
    expect(
      createBookingSchema.safeParse({
        facilityKey: 'box-cricket',
        date: '2026-10-07',
        startTime: '07:00',
        durationHours: 1,
        quoteId: 'client-total-100',
      }).success,
    ).toBe(false);
  });
});
