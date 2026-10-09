import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingDurationHours, FacilityKey } from '../../../../packages/types/src/index.js';
import {
  allowsShootingMachine,
  businessDateTime,
  businessTime,
  businessWeekday,
} from '../../../../packages/schemas/src/index.js';
import { HttpError } from '../errors/http-error.js';

export interface Facility {
  id: string;
  key: FacilityKey;
  name: string;
  active: boolean;
}

export interface FacilityAddon {
  id: string;
  facility_id: string;
  key: 'shooting-machine';
  name: string;
  active: boolean;
}

export interface Schedule {
  id: string;
  facility_id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
}

export interface ScheduleOverride {
  id: string;
  facility_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  closed: boolean;
}

export interface PricingTier {
  id: string;
  facility_id: string;
  addon_id: string | null;
  duration_hours: BookingDurationHours;
  amount_paise: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
}

export interface SlotAvailability {
  facilityId: string;
  date: string;
  startTime: string;
  durationHours: BookingDurationHours;
  available: boolean;
  reason?: string;
}

export interface AvailabilityListing {
  serverNow: string;
  businessTimeZone: 'Asia/Kolkata';
  date: string;
  durationHours: BookingDurationHours;
  slots: Array<{
    startTime: string;
    startsAt: string;
    endsAt: string;
    validEndsAt: string[];
  }>;
}

export interface PriceComponent {
  startsAt: string;
  endsAt: string;
  amountPaise: number;
  currency: string;
  pricingTierId: string;
}

export interface IntervalPrice {
  amountPaise: number;
  currency: string;
  components: PriceComponent[];
}

export class FacilitiesService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listActive(): Promise<Facility[]> {
    const { data, error } = await this.supabase
      .from('facilities')
      .select('id, key, name, active')
      .eq('active', true)
      .order('name');
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch facilities.');
    return (data ?? []) as Facility[];
  }

  async getByKey(key: FacilityKey): Promise<Facility | null> {
    const { data, error } = await this.supabase
      .from('facilities')
      .select('id, key, name, active')
      .eq('key', key)
      .eq('active', true)
      .maybeSingle();
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch facility.');
    return data as Facility | null;
  }

  async getAddons(facilityId: string): Promise<FacilityAddon[]> {
    const { data, error } = await this.supabase
      .from('facility_addons')
      .select('id, facility_id, key, name, active')
      .eq('facility_id', facilityId)
      .eq('active', true)
      .order('name');
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch add-ons.');
    return (data ?? []) as FacilityAddon[];
  }

  async validateFacilityAndAddon(
    facilityKey: FacilityKey,
    addonKey?: string,
  ): Promise<{ facility: Facility; addon?: FacilityAddon }> {
    const facility = await this.getByKey(facilityKey);
    if (!facility) throw new HttpError(400, 'INVALID_FACILITY', 'Facility not found or inactive.');
    if (!addonKey) return { facility };
    if (addonKey !== 'shooting-machine' || !allowsShootingMachine(facilityKey)) {
      throw new HttpError(
        400,
        'ADDON_NOT_ALLOWED',
        'This add-on is not available for the selected facility.',
      );
    }
    const addon = (await this.getAddons(facility.id)).find((item) => item.key === addonKey);
    if (!addon) throw new HttpError(400, 'ADDON_NOT_FOUND', 'Add-on not found or inactive.');
    return { facility, addon };
  }
}

export class SchedulesService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getWeeklySchedule(facilityId: string): Promise<Schedule[]> {
    const { data, error } = await this.supabase
      .from('schedules')
      .select('id, facility_id, weekday, opens_at, closes_at')
      .eq('facility_id', facilityId)
      .order('weekday');
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch schedule.');
    return (data ?? []) as Schedule[];
  }

  async getScheduleForDate(facilityId: string, date: string): Promise<Schedule | null> {
    const midday = businessDateTime(date, '12:00');
    const { data, error } = await this.supabase
      .from('schedules')
      .select('id, facility_id, weekday, opens_at, closes_at')
      .eq('facility_id', facilityId)
      .eq('weekday', businessWeekday(midday))
      .maybeSingle();
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch schedule.');
    return data as Schedule | null;
  }

  async getOverridesBetween(facilityId: string, from: Date, to: Date): Promise<ScheduleOverride[]> {
    const { data, error } = await this.supabase
      .from('schedule_overrides')
      .select('id, facility_id, starts_at, ends_at, reason, closed')
      .eq('facility_id', facilityId)
      .lt('starts_at', to.toISOString())
      .gt('ends_at', from.toISOString());
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to check schedule overrides.');
    return (data ?? []) as ScheduleOverride[];
  }

  async isFacilityOpen(
    facilityId: string,
    date: string,
    startTime: string,
    durationHours: BookingDurationHours,
  ): Promise<{ open: boolean; reason?: string }> {
    const slotStart = businessDateTime(date, startTime);
    const slotEnd = new Date(slotStart.getTime() + durationHours * 3_600_000);
    const { data: overrides, error: overrideError } = await this.supabase
      .from('schedule_overrides')
      .select('starts_at, ends_at, closed, reason')
      .eq('facility_id', facilityId)
      .lt('starts_at', slotEnd.toISOString())
      .gt('ends_at', slotStart.toISOString());
    if (overrideError)
      throw new HttpError(500, 'DATABASE_ERROR', 'Failed to check schedule overrides.');
    const closure = (overrides ?? []).find((item) => item.closed);
    if (closure) return { open: false, reason: closure.reason ?? 'Facility closed' };

    const schedule = await this.getScheduleForDate(facilityId, date);
    if (!schedule) return { open: false, reason: 'Facility closed on this day' };
    const opensAt = businessDateTime(date, schedule.opens_at.slice(0, 5));
    const closesAt = businessDateTime(date, schedule.closes_at.slice(0, 5));
    if (slotStart < opensAt || slotEnd > closesAt) {
      return {
        open: false,
        reason: `Facility open hours: ${schedule.opens_at} - ${schedule.closes_at}`,
      };
    }
    return { open: true };
  }
}

export class PricingService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getIntervalPrice(
    facilityId: string,
    addonId: string | null,
    startsAt: Date,
    durationHours: BookingDurationHours,
  ): Promise<IntervalPrice | null> {
    const tiers = await this.getAllPricing(facilityId);
    return this.intervalPriceFromTiers(tiers, addonId, startsAt, durationHours);
  }

  intervalPriceFromTiers(
    tiers: PricingTier[],
    addonId: string | null,
    startsAt: Date,
    durationHours: BookingDurationHours,
  ): IntervalPrice | null {
    const components: PriceComponent[] = [];
    for (let hour = 0; hour < durationHours; hour += 1) {
      const blockStart = new Date(startsAt.getTime() + hour * 3_600_000);
      const blockEnd = new Date(blockStart.getTime() + 3_600_000);
      const candidates = tiers
        .filter(
          (tier) =>
            tier.duration_hours === 1 &&
            (addonId ? tier.addon_id === addonId : tier.addon_id === null),
        )
        .filter((tier) => {
          const from = new Date(tier.effective_from);
          const to = tier.effective_to ? new Date(tier.effective_to) : null;
          return from <= blockStart && (!to || blockStart < to);
        })
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
      const tier = candidates[0];
      if (!tier) return null;
      components.push({
        startsAt: blockStart.toISOString(),
        endsAt: blockEnd.toISOString(),
        amountPaise: tier.amount_paise,
        currency: tier.currency,
        pricingTierId: tier.id,
      });
    }
    const currency = components[0]?.currency;
    if (!currency || components.some((component) => component.currency !== currency)) {
      return null;
    }
    return {
      amountPaise: components.reduce((total, component) => total + component.amountPaise, 0),
      currency,
      components,
    };
  }

  async getAllPricing(facilityId: string): Promise<PricingTier[]> {
    const { data, error } = await this.supabase
      .from('pricing_tiers')
      .select('*')
      .eq('facility_id', facilityId)
      .order('duration_hours')
      .order('effective_from', { ascending: false });
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch pricing tiers.');
    return (data ?? []) as PricingTier[];
  }
}

export class AvailabilityService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly schedulesService: SchedulesService,
    private readonly pricingService: PricingService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async checkSlotAvailability(
    facilityId: string,
    date: string,
    startTime: string,
    durationHours: BookingDurationHours,
    addonId: string | null,
  ): Promise<SlotAvailability> {
    const slotStart = businessDateTime(date, startTime);
    if (slotStart <= this.now())
      return this.unavailable(facilityId, date, startTime, durationHours, 'Slot is in the past');
    const schedule = await this.schedulesService.isFacilityOpen(
      facilityId,
      date,
      startTime,
      durationHours,
    );
    if (!schedule.open)
      return this.unavailable(
        facilityId,
        date,
        startTime,
        durationHours,
        schedule.reason ?? 'Facility closed',
      );

    const slotEnd = new Date(slotStart.getTime() + durationHours * 3_600_000);
    const { data: conflicts, error } = await this.supabase
      .from('bookings')
      .select('id, starts_at, ends_at, duration_hours')
      .eq('facility_id', facilityId)
      .in('status', ['pending', 'confirmed'])
      .lt('starts_at', slotEnd.toISOString())
      .gt('ends_at', slotStart.toISOString());
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to check availability.');
    const overlaps = (conflicts ?? []).some((booking) => {
      const bookingStart = new Date(booking.starts_at);
      const bookingEnd = new Date(booking.ends_at);
      return bookingStart < slotEnd && bookingEnd > slotStart;
    });
    if (overlaps)
      return this.unavailable(facilityId, date, startTime, durationHours, 'Slot already booked');
    if (
      !(await this.pricingService.getIntervalPrice(facilityId, addonId, slotStart, durationHours))
    ) {
      return this.unavailable(facilityId, date, startTime, durationHours, 'Pricing not configured');
    }
    return { facilityId, date, startTime, durationHours, available: true };
  }

  async listAvailability(
    facilityId: string,
    date: string,
    durationHours: BookingDurationHours,
    addonId: string | null,
  ): Promise<AvailabilityListing> {
    const serverNow = this.now();
    const schedule = await this.schedulesService.getScheduleForDate(facilityId, date);
    if (!schedule)
      return {
        serverNow: serverNow.toISOString(),
        businessTimeZone: 'Asia/Kolkata',
        date,
        durationHours,
        slots: [],
      };
    const opens = businessDateTime(date, schedule.opens_at.slice(0, 5));
    const closes = businessDateTime(date, schedule.closes_at.slice(0, 5));

    // Fetch everything the whole day needs in one round-trip per table instead of
    // re-querying per candidate slot (the previous loop made ~4 queries per slot).
    const [overrides, conflicts, pricingTiers] = await Promise.all([
      this.schedulesService.getOverridesBetween(facilityId, opens, closes),
      this.getConflictsBetween(facilityId, opens, closes),
      this.pricingService.getAllPricing(facilityId),
    ]);

    const slots: AvailabilityListing['slots'] = [];
    for (
      let instant = opens;
      instant.getTime() + durationHours * 3_600_000 <= closes.getTime();
      instant = new Date(instant.getTime() + 3_600_000)
    ) {
      const startTime = businessTime(instant);
      if (instant <= serverNow) continue;
      const validEndsAt: string[] = [];
      for (
        let candidateHours = 1;
        instant.getTime() + candidateHours * 3_600_000 <= closes.getTime();
        candidateHours += 1
      ) {
        const candidateEnd = new Date(instant.getTime() + candidateHours * 3_600_000);
        const closed = overrides.some(
          (override) =>
            override.closed &&
            new Date(override.starts_at) < candidateEnd &&
            new Date(override.ends_at) > instant,
        );
        const overlaps = conflicts.some((booking) => {
          const bookingStart = new Date(booking.starts_at);
          const bookingEnd = new Date(booking.ends_at);
          return bookingStart < candidateEnd && bookingEnd > instant;
        });
        const priceable = this.pricingService.intervalPriceFromTiers(
          pricingTiers,
          addonId,
          instant,
          candidateHours,
        );
        if (closed || overlaps || !priceable) break;
        validEndsAt.push(candidateEnd.toISOString());
      }
      const slotEnd = new Date(instant.getTime() + durationHours * 3_600_000);
      if (!validEndsAt.includes(slotEnd.toISOString())) continue;
      slots.push({
        startTime,
        startsAt: instant.toISOString(),
        endsAt: slotEnd.toISOString(),
        validEndsAt,
      });
    }
    return {
      serverNow: serverNow.toISOString(),
      businessTimeZone: 'Asia/Kolkata',
      date,
      durationHours,
      slots,
    };
  }

  private async getConflictsBetween(
    facilityId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ id: string; starts_at: string; ends_at: string }>> {
    const { data, error } = await this.supabase
      .from('bookings')
      .select('id, starts_at, ends_at')
      .eq('facility_id', facilityId)
      .in('status', ['pending', 'confirmed'])
      .lt('starts_at', to.toISOString())
      .gt('ends_at', from.toISOString());
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to check availability.');
    return data ?? [];
  }

  private unavailable(
    facilityId: string,
    date: string,
    startTime: string,
    durationHours: BookingDurationHours,
    reason: string,
  ): SlotAvailability {
    return { facilityId, date, startTime, durationHours, available: false, reason };
  }
}
