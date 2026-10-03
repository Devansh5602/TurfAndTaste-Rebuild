import { describe, expect, it } from 'vitest';
import {
  UNAUTHORIZED_SPORTS,
  addOnKeySchema,
  allowsShootingMachine,
  bookingDurationHoursSchema,
  facilityKeySchema,
  isPastSlot,
  quoteMatchesSelection,
} from './product';
import { businessDate } from './time';

describe('product rules', () => {
  it('accepts only authorized facilities', () => {
    expect(facilityKeySchema.parse('pickle-ball')).toBe('pickle-ball');
    for (const sport of UNAUTHORIZED_SPORTS) {
      expect(facilityKeySchema.safeParse(sport).success).toBe(false);
    }
    expect(facilityKeySchema.safeParse('shooting-machine').success).toBe(false);
  });

  it('treats the shooting machine as a green-net add-on', () => {
    expect(addOnKeySchema.parse('shooting-machine')).toBe('shooting-machine');
    expect(allowsShootingMachine('cricket-green-net')).toBe(true);
    expect(allowsShootingMachine('box-cricket')).toBe(false);
    expect(allowsShootingMachine('skating-rink')).toBe(false);
    expect(allowsShootingMachine('pickle-ball')).toBe(false);
  });

  it('allows only 1-hour and 2-hour durations', () => {
    expect(bookingDurationHoursSchema.parse(1)).toBe(1);
    expect(bookingDurationHoursSchema.parse(2)).toBe(2);
    expect(bookingDurationHoursSchema.safeParse(1.5).success).toBe(false);
  });

  it('invalidates a quote when the selection changes', () => {
    const quote = {
      facilityKey: 'box-cricket' as const,
      date: '2026-10-04',
      startTime: '18:00',
      durationHours: 1 as const,
    };
    expect(quoteMatchesSelection(quote, quote)).toBe(true);
    expect(quoteMatchesSelection(quote, { ...quote, durationHours: 2 })).toBe(false);
    expect(quoteMatchesSelection(quote, { ...quote, facilityKey: 'skating-rink' })).toBe(false);
  });

  it('rejects slots that start before the server clock', () => {
    const now = new Date('2026-10-03T12:00:00.000Z');
    expect(isPastSlot(new Date('2026-10-03T11:59:00.000Z'), now)).toBe(true);
    expect(isPastSlot(new Date('2026-10-03T12:00:00.000Z'), now)).toBe(false);
  });

  it('interprets business dates in Asia/Kolkata', () => {
    expect(businessDate(new Date('2026-10-03T18:30:00.000Z'))).toBe('2026-10-04');
    expect(businessDate(new Date('2026-10-03T18:00:00.000Z'))).toBe('2026-10-03');
  });
});
