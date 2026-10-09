import { describe, expect, it, vi } from 'vitest';
import { AvailabilityService, PricingService, SchedulesService } from './domain';
import type { HttpError } from '../errors/http-error';

const FACILITY_ID = 'facility-1';
const DATE = '2026-10-12'; // Sunday
const NOON_UTC_BEFORE_DATE = new Date('2026-10-10T10:00:00.000Z');

const SCHEDULE = {
  id: 'schedule-1',
  facility_id: FACILITY_ID,
  weekday: 0,
  opens_at: '06:00:00',
  closes_at: '22:00:00',
};

const TIER = {
  id: 'tier-1',
  facility_id: FACILITY_ID,
  addon_id: null,
  duration_hours: 1,
  amount_paise: 80000,
  currency: 'INR',
  effective_from: '2025-01-01T00:00:00+05:30',
  effective_to: null,
};

type TableResult = { data: unknown; error?: { message: string } | null };

function queryChain(result: TableResult) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'lt', 'gt', 'in', 'or', 'lte', 'is', 'order', 'limit'];
  for (const method of methods) chain[method] = () => chain;
  chain.maybeSingle = () => chain;
  chain.single = () => chain;
  chain.then = (resolve: (value: TableResult) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createSupabaseStub(tables: Record<string, () => TableResult>) {
  const from = vi.fn((table: string) => {
    const resolve = tables[table];
    if (!resolve) throw new Error(`Unexpected table access: ${table}`);
    return queryChain(resolve());
  });
  return { from } as never;
}

function createService(
  tables: Record<string, () => TableResult>,
  now: Date = NOON_UTC_BEFORE_DATE,
) {
  const supabase = createSupabaseStub(tables);
  const schedules = new SchedulesService(supabase);
  const pricing = new PricingService(supabase);
  return new AvailabilityService(supabase, schedules, pricing, () => now);
}

describe('AvailabilityService.listAvailability', () => {
  it('returns every open hourly slot for 1 hour', async () => {
    const service = createService({
      schedules: () => ({ data: SCHEDULE }),
      schedule_overrides: () => ({ data: [] }),
      bookings: () => ({ data: [] }),
      pricing_tiers: () => ({ data: [TIER] }),
    });

    const listing = await service.listAvailability(FACILITY_ID, DATE, 1, null);

    expect(listing.businessTimeZone).toBe('Asia/Kolkata');
    expect(listing.slots).toHaveLength(16); // 06:00 through 21:00 starts inside 06:00-22:00
    expect(listing.slots[0]).toMatchObject({
      startTime: '06:00',
      startsAt: '2026-10-12T00:30:00.000Z',
      endsAt: '2026-10-12T01:30:00.000Z',
    });
    expect(listing.slots[0]?.validEndsAt).toHaveLength(16);
    expect(listing.slots.at(-1)?.startTime).toBe('21:00');
  });

  it('returns only contiguous 2 hour windows', async () => {
    const service = createService({
      schedules: () => ({ data: SCHEDULE }),
      schedule_overrides: () => ({ data: [] }),
      bookings: () => ({ data: [] }),
      pricing_tiers: () => ({ data: [TIER] }),
    });

    const listing = await service.listAvailability(FACILITY_ID, DATE, 2, null);

    expect(listing.slots).toHaveLength(15); // 06:00 through 20:00 starts fit before 22:00
    expect(listing.slots.at(-1)?.startTime).toBe('20:00');
  });

  it('returns a custom 4 hour interval only across contiguous available blocks', async () => {
    const service = createService({
      schedules: () => ({ data: SCHEDULE }),
      schedule_overrides: () => ({ data: [] }),
      bookings: () => ({ data: [] }),
      pricing_tiers: () => ({ data: [TIER] }),
    });

    const listing = await service.listAvailability(FACILITY_ID, DATE, 4, null);

    expect(listing.slots).toHaveLength(13);
    expect(listing.slots[0]).toMatchObject({
      startTime: '06:00',
      endsAt: '2026-10-12T04:30:00.000Z',
    });
  });

  it('rejects a custom interval with a conflict in a constituent hour', async () => {
    const service = createService({
      schedules: () => ({ data: SCHEDULE }),
      schedule_overrides: () => ({ data: [] }),
      bookings: () => ({
        data: [
          {
            id: 'booking-1',
            starts_at: '2026-10-12T08:00:00+05:30',
            ends_at: '2026-10-12T09:00:00+05:30',
          },
        ],
      }),
      pricing_tiers: () => ({ data: [TIER] }),
    });

    const listing = await service.listAvailability(FACILITY_ID, DATE, 3, null);

    expect(listing.slots.map((slot) => slot.startTime)).not.toContain('06:00');
  });

  it('prices each constituent hour across effective tariff boundaries', () => {
    const pricing = new PricingService({} as never);
    const price = pricing.intervalPriceFromTiers(
      [
        { ...TIER, id: 'off-peak', effective_to: '2026-10-12T07:30:00.000Z' },
        {
          ...TIER,
          id: 'peak',
          amount_paise: 90000,
          effective_from: '2026-10-12T07:30:00.000Z',
        },
      ],
      null,
      new Date('2026-10-12T06:30:00.000Z'),
      3,
    );

    expect(price?.components.map((component) => component.pricingTierId)).toEqual([
      'off-peak',
      'peak',
      'peak',
    ]);
    expect(price?.amountPaise).toBe(260000);
  });

  it('excludes slots that already passed on the selected date', async () => {
    // 2026-10-12 19:30 Asia/Kolkata == 14:00 UTC
    const service = createService(
      {
        schedules: () => ({ data: SCHEDULE }),
        schedule_overrides: () => ({ data: [] }),
        bookings: () => ({ data: [] }),
        pricing_tiers: () => ({ data: [TIER] }),
      },
      new Date('2026-10-12T14:00:00.000Z'),
    );

    const listing = await service.listAvailability(FACILITY_ID, DATE, 1, null);

    expect(listing.slots.map((slot) => slot.startTime)).toEqual(['20:00', '21:00']);
  });

  it('removes only the slots overlapped by a closed override', async () => {
    const service = createService({
      schedules: () => ({ data: SCHEDULE }),
      schedule_overrides: () => ({
        data: [
          {
            id: 'override-1',
            facility_id: FACILITY_ID,
            starts_at: '2026-10-12T12:00:00+05:30',
            ends_at: '2026-10-12T14:00:00+05:30',
            reason: 'Private event',
            closed: true,
          },
        ],
      }),
      bookings: () => ({ data: [] }),
      pricing_tiers: () => ({ data: [TIER] }),
    });

    const listing = await service.listAvailability(FACILITY_ID, DATE, 1, null);

    expect(listing.slots).toHaveLength(14);
    expect(listing.slots.map((slot) => slot.startTime)).not.toContain('12:00');
    expect(listing.slots.map((slot) => slot.startTime)).not.toContain('13:00');
  });

  it('removes slots overlapped by pending or confirmed bookings', async () => {
    const service = createService({
      schedules: () => ({ data: SCHEDULE }),
      schedule_overrides: () => ({ data: [] }),
      bookings: () => ({
        data: [
          {
            id: 'booking-1',
            starts_at: '2026-10-12T09:00:00+05:30',
            ends_at: '2026-10-12T10:00:00+05:30',
          },
        ],
      }),
      pricing_tiers: () => ({ data: [TIER] }),
    });

    const listing = await service.listAvailability(FACILITY_ID, DATE, 1, null);

    expect(listing.slots.map((slot) => slot.startTime)).not.toContain('09:00');
    expect(listing.slots).toHaveLength(15);
  });

  it('returns an empty listing when the facility has no schedule that day', async () => {
    const service = createService({
      schedules: () => ({ data: null }),
      schedule_overrides: () => ({ data: [] }),
      bookings: () => ({ data: [] }),
      pricing_tiers: () => ({ data: [TIER] }),
    });

    const listing = await service.listAvailability(FACILITY_ID, DATE, 1, null);

    expect(listing.slots).toEqual([]);
  });

  it('returns an empty listing when pricing is not configured', async () => {
    const service = createService({
      schedules: () => ({ data: SCHEDULE }),
      schedule_overrides: () => ({ data: [] }),
      bookings: () => ({ data: [] }),
      pricing_tiers: () => ({ data: [] }),
    });

    const listing = await service.listAvailability(FACILITY_ID, DATE, 1, null);

    expect(listing.slots).toEqual([]);
  });

  it('surfaces database failures as 500 instead of pretending there are no slots', async () => {
    const service = createService({
      schedules: () => ({ data: SCHEDULE }),
      schedule_overrides: () => ({ data: [] }),
      bookings: () => ({ data: null, error: { message: 'connection lost' } }),
      pricing_tiers: () => ({ data: [TIER] }),
    });

    await expect(service.listAvailability(FACILITY_ID, DATE, 1, null)).rejects.toMatchObject({
      status: 500,
      code: 'DATABASE_ERROR',
    } satisfies Partial<HttpError>);
  });

  it('queries each table once for the whole day instead of once per slot', async () => {
    const counts: Record<string, number> = {};
    const tables: Record<string, () => TableResult> = {
      schedules: () => ({ data: SCHEDULE }),
      schedule_overrides: () => ({ data: [] }),
      bookings: () => ({ data: [] }),
      pricing_tiers: () => ({ data: [TIER] }),
    };
    const service = createService(
      Object.fromEntries(
        Object.entries(tables).map(([table, resolve]) => [
          table,
          () => {
            counts[table] = (counts[table] ?? 0) + 1;
            return resolve();
          },
        ]),
      ),
    );

    await service.listAvailability(FACILITY_ID, DATE, 1, null);

    expect(counts).toEqual({
      schedules: 1,
      schedule_overrides: 1,
      bookings: 1,
      pricing_tiers: 1,
    });
  });
});
