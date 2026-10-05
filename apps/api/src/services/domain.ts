import type { SupabaseClient } from '@supabase/supabase-js';
import type { FacilityKey, BookingDurationHours } from '@turf-and-taste/types';
import { allowsShootingMachine } from '@turf-and-taste/schemas';
import { HttpError } from '../errors/http-error';

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
  facility_id: string;
  date: string; // YYYY-MM-DD in Asia/Kolkata
  start_time: string; // HH:mm
  duration_hours: BookingDurationHours;
  available: boolean;
  reason?: string;
}

export class FacilitiesService {
  constructor(private supabase: SupabaseClient) {}

  async listActive(): Promise<Facility[]> {
    const { data, error } = await this.supabase
      .from('facilities')
      .select('id, key, name, active')
      .eq('active', true)
      .order('name');

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch facilities.');
    return data ?? [];
  }

  async getByKey(key: FacilityKey): Promise<Facility | null> {
    const { data, error } = await this.supabase
      .from('facilities')
      .select('id, key, name, active')
      .eq('key', key)
      .eq('active', true)
      .maybeSingle();

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch facility.');
    return data;
  }

  async getAddons(facilityId: string): Promise<FacilityAddon[]> {
    const { data, error } = await this.supabase
      .from('facility_addons')
      .select('id, facility_id, key, name, active')
      .eq('facility_id', facilityId)
      .eq('active', true)
      .order('name');

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch add-ons.');
    return data ?? [];
  }

  async validateFacilityAndAddon(facilityKey: FacilityKey, addonKey?: string): Promise<{ facility: Facility; addon?: FacilityAddon }> {
    const facility = await this.getByKey(facilityKey);
    if (!facility) {
      throw new HttpError(400, 'INVALID_FACILITY', 'Facility not found or inactive.');
    }

    if (addonKey) {
      if (addonKey !== 'shooting-machine') {
        throw new HttpError(400, 'INVALID_ADDON', 'Invalid add-on.');
      }
      if (!allowsShootingMachine(facilityKey)) {
        throw new HttpError(400, 'ADDON_NOT_ALLOWED', 'This add-on is not available for the selected facility.');
      }

      const { data: addon, error } = await this.supabase
        .from('facility_addons')
        .select('id, facility_id, key, name, active')
        .eq('facility_id', facility.id)
        .eq('key', addonKey)
        .eq('active', true)
        .maybeSingle();

      if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to validate add-on.');
      if (!addon) {
        throw new HttpError(400, 'ADDON_NOT_FOUND', 'Add-on not found or inactive.');
      }

      return { facility, addon };
    }

    return { facility };
  }
}

export class SchedulesService {
  constructor(private supabase: SupabaseClient) {}

  async getWeeklySchedule(facilityId: string): Promise<Schedule[]> {
    const { data, error } = await this.supabase
      .from('schedules')
      .select('id, facility_id, weekday, opens_at, closes_at')
      .eq('facility_id', facilityId)
      .order('weekday');

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch schedule.');
    return data ?? [];
  }

  async getOverrides(facilityId: string, from: Date, to: Date): Promise<ScheduleOverride[]> {
    const { data, error } = await this.supabase
      .from('schedule_overrides')
      .select('id, facility_id, starts_at, ends_at, reason, closed')
      .eq('facility_id', facilityId)
      .lte('starts_at', to.toISOString())
      .gte('ends_at', from.toISOString())
      .order('starts_at');

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch schedule overrides.');
    return data ?? [];
  }

  setSupabase(client: SupabaseClient) {
    this.supabase = client;
  }

  async isFacilityOpen(
    facilityId: string,
    date: Date, // in Asia/Kolkata
    startTime: string, // HH:mm
    durationHours: BookingDurationHours,
  ): Promise<{ open: boolean; reason?: string }> {
    const weekday = date.getDay(); // 0 = Sunday
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = startMinutes + durationHours * 60;

    // Check overrides first
    const { data: overrides } = await this.supabase
      .from('schedule_overrides')
      .select('starts_at, ends_at, closed, reason')
      .eq('facility_id', facilityId)
      .lte('starts_at', date.toISOString())
      .gte('ends_at', date.toISOString())
      .maybeSingle();

    if (overrides) {
      if (overrides.closed) {
        return { open: false, reason: overrides.reason ?? 'Facility closed' };
      }
      // If not closed, check if the slot falls within override hours
      // For simplicity, if there's a non-closed override, we allow but this could be extended
    }

    // Check regular schedule
    const { data: schedule } = await this.supabase
      .from('schedules')
      .select('opens_at, closes_at')
      .eq('facility_id', facilityId)
      .eq('weekday', weekday)
      .maybeSingle();

    if (!schedule) {
      return { open: false, reason: 'Facility closed on this day' };
    }

    const opensMinutes = this.timeToMinutes(schedule.opens_at);
    const closesMinutes = this.timeToMinutes(schedule.closes_at);

    if (startMinutes < opensMinutes || endMinutes > closesMinutes) {
      return { open: false, reason: `Facility open hours: ${schedule.opens_at} - ${schedule.closes_at}` };
    }

    return { open: true };
  }

  private timeToMinutes(time: string): number {
    const parts = time.split(':');
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      throw new HttpError(400, 'INVALID_TIME', 'Invalid time format');
    }
    return hours * 60 + minutes;
  }
}

export class PricingService {
  constructor(private supabase: SupabaseClient) {}

  async getPrice(
    facilityId: string,
    addonId: string | null,
    durationHours: BookingDurationHours,
    at: Date = new Date(),
  ): Promise<{ amount_paise: number; currency: string } | null> {
    let query = this.supabase
      .from('pricing_tiers')
      .select('amount_paise, currency')
      .eq('facility_id', facilityId)
      .eq('duration_hours', durationHours)
      .lte('effective_from', at.toISOString())
      .or(`effective_to.is.null,effective_to.gte.${at.toISOString()}`)
      .order('effective_from', { ascending: false })
      .limit(1);

    if (addonId) {
      query = query.eq('addon_id', addonId);
    } else {
      query = query.is('addon_id', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch pricing.');
    return data ?? null;
  }

  async getAllPricing(facilityId: string): Promise<PricingTier[]> {
    const { data, error } = await this.supabase
      .from('pricing_tiers')
      .select('*')
      .eq('facility_id', facilityId)
      .order('duration_hours')
      .order('effective_from', { ascending: false });

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch pricing tiers.');
    return data ?? [];
  }
}

export class AvailabilityService {
  private supabase: SupabaseClient;

  constructor(
    private schedulesService: SchedulesService,
    private pricingService: PricingService,
  ) {
    this.supabase = schedulesService['supabase'] as SupabaseClient;
  }

  async checkSlotAvailability(
    facilityId: string,
    date: Date, // Asia/Kolkata date
    startTime: string, // HH:mm
    durationHours: BookingDurationHours,
    addonId: string | null,
  ): Promise<SlotAvailability> {
    // Check if slot is in the past (using server time in Asia/Kolkata)
    const now = new Date();
    const slotStart = new Date(date);
    const timeParts = startTime.split(':');
    const hours = Number(timeParts[0]);
    const minutes = Number(timeParts[1]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return this.createUnavailableResponse(facilityId, date, startTime, durationHours, 'Invalid time format');
    }
    slotStart.setHours(hours, minutes, 0, 0);

    if (slotStart <= now) {
      return this.createUnavailableResponse(facilityId, date, startTime, durationHours, 'Slot is in the past');
    }

    // Check facility schedule
    const { open, reason } = await this.schedulesService.isFacilityOpen(
      facilityId,
      date,
      startTime,
      durationHours,
    );

    if (!open) {
      return this.createUnavailableResponse(facilityId, date, startTime, durationHours, reason ?? 'Facility not available');
    }

    // Check for existing bookings that overlap
    const slotEnd = new Date(slotStart.getTime() + durationHours * 60 * 60 * 1000);

    const { data: conflicts, error } = await this.supabase
      .from('bookings')
      .select('id, starts_at, duration_hours')
      .eq('status', 'confirmed')
      .lt('starts_at', slotEnd.toISOString())
      .gte('starts_at', slotStart.toISOString())
      .limit(1);

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to check availability.');

    // Also check bookings that start before but end after our slot starts
    const { data: conflicts2, error: error2 } = await this.supabase
      .from('bookings')
      .select('id, starts_at, duration_hours')
      .eq('status', 'confirmed')
      .lt('starts_at', slotStart.toISOString())
      .gte('starts_at', new Date(slotStart.getTime() - 2 * 60 * 60 * 1000).toISOString()) // max 2 hours before
      .limit(10);

    if (error2) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to check availability.');

    // Check overlap for conflicts2
    const hasOverlap = (conflicts2 ?? []).some((b) => {
      const bookingStart = new Date(b.starts_at);
      const bookingEnd = new Date(bookingStart.getTime() + b.duration_hours * 60 * 60 * 1000);
      return bookingEnd > slotStart;
    });

    if ((conflicts && conflicts.length > 0) || hasOverlap) {
      return this.createUnavailableResponse(facilityId, date, startTime, durationHours, 'Slot already booked');
    }

    // Check pricing exists
    const price = await this.pricingService.getPrice(facilityId, addonId, durationHours);
    if (!price) {
      return this.createUnavailableResponse(facilityId, date, startTime, durationHours, 'Pricing not configured for this selection');
    }

    return {
      facility_id: facilityId,
      date: date.toISOString().split('T')[0] ?? '',
      start_time: startTime,
      duration_hours: durationHours,
      available: true,
    };
  }

  private createUnavailableResponse(
    facilityId: string,
    date: Date,
    startTime: string,
    durationHours: BookingDurationHours,
    reason: string,
  ): SlotAvailability {
    return {
      facility_id: facilityId,
      date: date.toISOString().split('T')[0] ?? '',
      start_time: startTime,
      duration_hours: durationHours,
      available: false,
      reason,
    };
  }

  setSupabase(client: SupabaseClient) {
    this.supabase = client;
    this.schedulesService.setSupabase(client);
  }
}