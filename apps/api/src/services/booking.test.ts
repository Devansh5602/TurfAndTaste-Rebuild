import { describe, expect, it, vi } from 'vitest';
import { QuoteService } from './booking';

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
