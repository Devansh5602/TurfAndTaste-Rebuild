import { describe, expect, it, vi } from 'vitest';
import { BookingService, QuoteService } from './booking';
import { HttpError } from '../errors/http-error';

const selection = {
  facilityKey: 'cricket-green-net' as const,
  date: '2026-10-07',
  startTime: '07:00',
  durationHours: 1 as const,
  addOnKey: 'shooting-machine' as const,
};

function createInsertChain(row: Record<string, unknown>) {
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn(async () => ({ data: row, error: null })) })),
      })),
    })),
  };
}

describe('QuoteService', () => {
  it('uses real facility relationships and server pricing', async () => {
    const row = {
      id: '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66',
      facility_id: 'facility-id',
      facility_key: 'cricket-green-net',
      addon_id: 'addon-id',
      addon_key: 'shooting-machine',
      starts_at: '2026-10-07T01:30:00.000Z',
      duration_hours: 1,
      amount_paise: 100000,
      currency: 'INR',
      expires_at: '2026-10-06T13:15:00.000Z',
    };
    const facilities = {
      validateFacilityAndAddon: vi.fn(async () => ({
        facility: { id: 'facility-id', key: 'cricket-green-net', name: 'Green Net', active: true },
        addon: {
          id: 'addon-id',
          facility_id: 'facility-id',
          key: 'shooting-machine',
          name: 'Shooting Machine',
          active: true,
        },
      })),
    };
    const availability = { checkSlotAvailability: vi.fn(async () => ({ available: true })) };
    const pricing = { getPrice: vi.fn(async () => ({ amount_paise: 100000, currency: 'INR' })) };
    const service = new QuoteService(
      createInsertChain(row) as never,
      availability as never,
      pricing as never,
      facilities as never,
      () => new Date('2026-10-06T13:00:00.000Z'),
    );

    const quote = await service.createQuote(selection, 'customer-id');
    expect(quote.amountPaise).toBe(100000);
    expect(quote.addonId).toBe('addon-id');
    expect(facilities.validateFacilityAndAddon).toHaveBeenCalledWith(
      'cricket-green-net',
      'shooting-machine',
    );
    expect(pricing.getPrice).toHaveBeenCalledWith('facility-id', 'addon-id', 1, expect.any(Date));
  });

  it('refuses to quote an unavailable slot', async () => {
    const service = new QuoteService(
      {} as never,
      {
        checkSlotAvailability: vi.fn(async () => ({ available: false, reason: 'Facility closed' })),
      } as never,
      {} as never,
      {
        validateFacilityAndAddon: vi.fn(async () => ({
          facility: { id: 'facility-id', key: 'cricket-green-net' },
          addon: { id: 'addon-id' },
        })),
      } as never,
    );
    await expect(service.createQuote(selection, 'customer-id')).rejects.toMatchObject({
      status: 409,
      code: 'SLOT_UNAVAILABLE',
    });
  });
});

describe('BookingService', () => {
  it('maps a database overlap to a friendly conflict', async () => {
    const quoteService = {
      getOwnedQuote: vi.fn(async () => ({
        id: '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66',
        facilityKey: 'box-cricket',
        facilityId: 'facility-id',
        date: '2026-10-07',
        startTime: '07:00',
        startsAt: '2026-10-07T01:30:00.000Z',
        durationHours: 1,
        amountPaise: 80000,
        currency: 'INR',
        expiresAt: '2026-10-07T01:00:00.000Z',
      })),
    };
    const supabase = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: '23P01', message: 'SLOT_CONFLICT' },
      })),
    };
    const service = new BookingService(supabase as never, quoteService as never);
    await expect(
      service.createBooking('customer-id', {
        facilityKey: 'box-cricket',
        date: '2026-10-07',
        startTime: '07:00',
        durationHours: 1,
        quoteId: '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66',
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'SLOT_CONFLICT',
      message: 'The selected time is no longer available.',
    });
  });

  it('never sends a client total or customer id into the booking transaction', async () => {
    const quoteService = {
      getOwnedQuote: vi.fn(async () => ({
        id: '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66',
        facilityKey: 'box-cricket',
        facilityId: 'facility-id',
        date: '2026-10-07',
        startTime: '07:00',
        startsAt: '2026-10-07T01:30:00.000Z',
        durationHours: 1,
        amountPaise: 80000,
        currency: 'INR',
        expiresAt: '2026-10-07T01:00:00.000Z',
      })),
    };
    const supabase = {
      rpc: vi.fn(async () => ({ data: 'booking-id', error: null })),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
          })),
        })),
      })),
    };
    const service = new BookingService(supabase as never, quoteService as never);
    await expect(
      service.createBooking('authenticated-customer', {
        facilityKey: 'box-cricket',
        date: '2026-10-07',
        startTime: '07:00',
        durationHours: 1,
        quoteId: '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66',
      }),
    ).rejects.toMatchObject({ code: 'DATABASE_ERROR' });
    expect(supabase.rpc).toHaveBeenCalledWith('create_booking_from_quote', {
      p_customer_profile_id: 'authenticated-customer',
      p_quote_id: '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66',
    });
  });

  // booking_items_one_per_booking makes the embed a one-to-one relationship, so
  // PostgREST returns a single object rather than an array. Regression: mapping
  // must not throw a raw TypeError that the error handler masks as INTERNAL_ERROR.
  const singleItemEmbed = {
    id: 'booking-1',
    customer_profile_id: 'customer-1',
    status: 'pending',
    starts_at: '2026-10-07T01:30:00.000Z',
    duration_hours: 1,
    quoted_amount_paise: 80000,
    currency: 'INR',
    quote_expires_at: '2026-10-07T01:00:00.000Z',
    created_at: '2026-10-06T10:00:00.000Z',
    updated_at: '2026-10-06T10:00:00.000Z',
    booking_items: {
      id: 'item-1',
      booking_id: 'booking-1',
      facility_id: 'facility-1',
      addon_id: null,
      amount_paise: 80000,
      facilities: { key: 'box-cricket', name: 'Box Cricket' },
      facility_addons: null,
    },
  };

  function chainReturning(row: Record<string, unknown> | null) {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: row, error: null })) })),
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: row ? [row] : [], error: null })),
          })),
        })),
      })),
    };
  }

  it('formats a booking when the items embed is a single object (one-to-one)', async () => {
    const service = new BookingService(
      { from: vi.fn(() => chainReturning(singleItemEmbed)) } as never,
      {} as never,
    );

    const booking = await service.getBooking('booking-1', 'customer-1');

    expect(booking?.items).toHaveLength(1);
    expect(booking?.items[0]).toMatchObject({
      facilityKey: 'box-cricket',
      facilityName: 'Box Cricket',
      addonKey: null,
      amountPaise: 80000,
    });
  });

  it('returns the existing customer booking when a committed quote is replayed', async () => {
    const expired = new HttpError(409, 'QUOTE_EXPIRED', 'expired');
    const quoteService = { getOwnedQuote: vi.fn(async () => Promise.reject(expired)) };
    const supabase = {
      rpc: vi.fn(),
      from: vi.fn(() => chainReturning(singleItemEmbed)),
    };
    const service = new BookingService(supabase as never, quoteService as never);

    const booking = await service.createBooking('customer-1', {
      facilityKey: 'box-cricket',
      date: '2026-10-07',
      startTime: '07:00',
      durationHours: 1,
      quoteId: 'quote-1',
    });

    expect(booking.id).toBe('booking-1');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('completes booking creation when the read-back items embed is a single object', async () => {
    const quoteService = {
      getOwnedQuote: vi.fn(async () => ({
        id: 'quote-1',
        facilityKey: 'box-cricket',
        facilityId: 'facility-1',
        date: '2026-10-07',
        startTime: '07:00',
        startsAt: '2026-10-07T01:30:00.000Z',
        durationHours: 1,
        amountPaise: 80000,
        currency: 'INR',
        expiresAt: '2026-10-07T15:00:00.000Z',
      })),
    };
    const supabase = {
      rpc: vi.fn(async () => ({ data: 'booking-1', error: null })),
      from: vi.fn(() => chainReturning(singleItemEmbed)),
    };
    const service = new BookingService(supabase as never, quoteService as never);

    const booking = await service.createBooking('customer-1', {
      facilityKey: 'box-cricket',
      date: '2026-10-07',
      startTime: '07:00',
      durationHours: 1,
      quoteId: 'quote-1',
    });

    expect(booking.id).toBe('booking-1');
    expect(booking.items).toHaveLength(1);
    expect(booking.items[0]?.facilityKey).toBe('box-cricket');
  });
});
