import type { SupabaseClient } from '@supabase/supabase-js';
import type { FacilityKey, BookingDurationHours } from '@turf-and-taste/types';
import type { QuoteSelection } from '@turf-and-taste/schemas';
import {
  facilityKeySchema,
  bookingDurationHoursSchema,
  addOnKeySchema,
  allowsShootingMachine,
  quoteMatchesSelection,
  isPastSlot,
} from '@turf-and-taste/schemas';
import { HttpError } from '../errors/http-error';
import type { AvailabilityService, PricingService } from './domain';
import { v4 as uuidv4 } from 'uuid';

export interface Quote {
  id: string;
  facilityKey: FacilityKey;
  facilityId: string;
  addonKey?: 'shooting-machine';
  addonId?: string;
  date: string; // YYYY-MM-DD in Asia/Kolkata
  startTime: string; // HH:mm
  durationHours: BookingDurationHours;
  amountPaise: number;
  currency: string;
  expiresAt: string; // ISO timestamp
}

export interface CreateBookingInput {
  facilityKey: FacilityKey;
  addonKey?: 'shooting-machine';
  date: string;
  startTime: string;
  durationHours: BookingDurationHours;
  quoteId: string;
}

export interface Booking {
  id: string;
  customerProfileId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  startsAt: string;
  durationHours: BookingDurationHours;
  quotedAmountPaise: number;
  currency: string;
  quoteExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: BookingItem[];
}

export interface BookingItem {
  id: string;
  bookingId: string;
  facilityId: string;
  addonId: string | null;
  amountPaise: number;
}

export class QuoteService {
  private quotes = new Map<string, Quote>();
  private readonly quoteValidityMinutes = 15;

  constructor(
    private availabilityService: AvailabilityService,
    private pricingService: PricingService,
  ) {}

  async createQuote(
    selection: QuoteSelection,
    _customerId: string,
  ): Promise<Quote> {
    // Validate inputs
    const facilityKey = facilityKeySchema.parse(selection.facilityKey);
    const durationHours = bookingDurationHoursSchema.parse(selection.durationHours);

    if (selection.addOnKey) {
      addOnKeySchema.parse(selection.addOnKey);
      if (!allowsShootingMachine(facilityKey)) {
        throw new HttpError(400, 'ADDON_NOT_ALLOWED', 'This add-on is not available for the selected facility.');
      }
    }

    // Parse date and time
    const date = new Date(selection.date + 'T00:00:00+05:30'); // Asia/Kolkata
    const timeParts = selection.startTime.split(':');
    const hours = Number(timeParts[0]);
    const minutes = Number(timeParts[1]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      throw new HttpError(400, 'INVALID_TIME', 'Invalid start time format');
    }
    const slotStart = new Date(date);
    slotStart.setHours(hours, minutes, 0, 0);

    // Check if past slot
    if (isPastSlot(slotStart, new Date())) {
      throw new HttpError(400, 'PAST_SLOT', 'Cannot book a slot in the past.');
    }

    // Check availability
    const facility = await this.getFacilityByKey(facilityKey);
    if (!facility) {
      throw new HttpError(400, 'INVALID_FACILITY', 'Facility not found.');
    }

    const addonId = selection.addOnKey
      ? await this.getAddonId(facility.id, selection.addOnKey)
      : null;

    const availability = await this.availabilityService.checkSlotAvailability(
      facility.id,
      date,
      selection.startTime,
      durationHours,
      addonId,
    );

    if (!availability.available) {
      throw new HttpError(400, 'SLOT_UNAVAILABLE', availability.reason ?? 'Slot is not available.');
    }

    // Get pricing
    const price = await this.pricingService.getPrice(facility.id, addonId, durationHours);
    if (!price) {
      throw new HttpError(400, 'PRICING_NOT_FOUND', 'Pricing not configured for this selection.');
    }

    // Create quote
    const quoteId = uuidv4();
    const expiresAt = new Date(Date.now() + this.quoteValidityMinutes * 60 * 1000);

    const quote: Quote = {
      id: quoteId,
      facilityKey,
      facilityId: facility.id,
      addonKey: selection.addOnKey as 'shooting-machine' | undefined,
      addonId: addonId ?? undefined,
      date: selection.date,
      startTime: selection.startTime,
      durationHours,
      amountPaise: price.amount_paise,
      currency: price.currency,
      expiresAt: expiresAt.toISOString(),
    };

    this.quotes.set(quoteId, quote);
    return quote;
  }

  getQuote(quoteId: string): Quote | undefined {
    const quote = this.quotes.get(quoteId);
    if (!quote) return undefined;

    // Check expiry
    if (new Date(quote.expiresAt) < new Date()) {
      this.quotes.delete(quoteId);
      return undefined;
    }

    return quote;
  }

  validateQuote(quoteId: string, selection: QuoteSelection): Quote {
    const quote = this.getQuote(quoteId);
    if (!quote) {
      throw new HttpError(400, 'QUOTE_EXPIRED', 'Quote has expired or does not exist.');
    }

    if (!quoteMatchesSelection(quote, selection)) {
      throw new HttpError(400, 'QUOTE_MISMATCH', 'Quote does not match the current selection.');
    }

    return quote;
  }

  private async getFacilityByKey(key: FacilityKey) {
    // This would normally query the database
    // For now, we'll return a mock - in production this would use the FacilitiesService
    return { id: key, key, name: '', active: true };
  }

  private async getAddonId(facilityId: string, addonKey: string) {
    // Mock - in production this would query the database
    return `${facilityId}-${addonKey}`;
  }
}

export class BookingService {
  constructor(
    private supabase: SupabaseClient,
    private quoteService: QuoteService,
    private availabilityService: AvailabilityService,
  ) {}

  async createBooking(customerId: string, input: CreateBookingInput): Promise<Booking> {
    // Validate quote
    const selection: QuoteSelection = {
      facilityKey: input.facilityKey,
      addOnKey: input.addonKey,
      date: input.date,
      startTime: input.startTime,
      durationHours: input.durationHours,
    };

    const quote = this.quoteService.validateQuote(input.quoteId, selection);

    // Parse start time
    const date = new Date(input.date + 'T00:00:00+05:30');
    const timeParts = input.startTime.split(':');
    const hours = Number(timeParts[0]);
    const minutes = Number(timeParts[1]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      throw new HttpError(400, 'INVALID_TIME', 'Invalid start time format');
    }
    const startsAt = new Date(date);
    startsAt.setHours(hours, minutes, 0, 0);

    // Double-check availability at booking time (race condition protection)
    const availability = await this.availabilityService.checkSlotAvailability(
      quote.facilityId,
      date,
      input.startTime,
      input.durationHours,
      quote.addonId ?? null,
    );

    if (!availability.available) {
      throw new HttpError(409, 'SLOT_CONFLICT', 'Slot was booked by another customer. Please select a different time.');
    }

    // Create booking in database
    const { data: booking, error } = await this.supabase
      .from('bookings')
      .insert({
        customer_profile_id: customerId,
        status: 'pending',
        starts_at: startsAt.toISOString(),
        duration_hours: input.durationHours,
        quoted_amount_paise: quote.amountPaise,
        currency: quote.currency,
        quote_expires_at: quote.expiresAt,
      })
      .select()
      .single();

    if (error || !booking) {
      throw new HttpError(500, 'DATABASE_ERROR', 'Failed to create booking.');
    }

    // Create booking item
    const { error: itemError } = await this.supabase
      .from('booking_items')
      .insert({
        booking_id: booking.id,
        facility_id: quote.facilityId,
        addon_id: quote.addonId ?? null,
        amount_paise: quote.amountPaise,
      });

    if (itemError) {
      // Rollback booking
      await this.supabase.from('bookings').delete().eq('id', booking.id);
      throw new HttpError(500, 'DATABASE_ERROR', 'Failed to create booking item.');
    }

    return this.formatBooking(booking, [{ id: '', booking_id: booking.id, facility_id: quote.facilityId, addon_id: quote.addonId ?? null, amount_paise: quote.amountPaise }]);
  }

  async getBooking(bookingId: string, customerId?: string): Promise<Booking | null> {
    let query = this.supabase
      .from('bookings')
      .select(`
        *,
        booking_items (*)
      `)
      .eq('id', bookingId);

    if (customerId) {
      query = query.eq('customer_profile_id', customerId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch booking.');
    if (!data) return null;

    return this.formatBooking(data, data.booking_items ?? []);
  }

  async listBookings(customerId: string, status?: string): Promise<Booking[]> {
    let query = this.supabase
      .from('bookings')
      .select(`
        *,
        booking_items (*)
      `)
      .eq('customer_profile_id', customerId)
      .order('starts_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch bookings.');

    return (data ?? []).map((b) => this.formatBooking(b, b.booking_items ?? []));
  }

  async cancelBooking(bookingId: string, customerId: string): Promise<Booking> {
    const { data: booking, error } = await this.supabase
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('customer_profile_id', customerId)
      .eq('status', 'pending')
      .select(`
        *,
        booking_items (*)
      `)
      .single();

    if (error || !booking) {
      throw new HttpError(400, 'BOOKING_NOT_CANCELLABLE', 'Booking cannot be cancelled.');
    }

    return this.formatBooking(booking, booking.booking_items ?? []);
  }

  private formatBooking(booking: Record<string, unknown>, items: Record<string, unknown>[]): Booking {
    return {
      id: booking.id as string,
      customerProfileId: booking.customer_profile_id as string,
      status: booking.status as Booking['status'],
      startsAt: booking.starts_at as string,
      durationHours: booking.duration_hours as BookingDurationHours,
      quotedAmountPaise: booking.quoted_amount_paise as number,
      currency: booking.currency as string,
      quoteExpiresAt: (booking.quote_expires_at as string) ?? null,
      createdAt: booking.created_at as string,
      updatedAt: booking.updated_at as string,
      items: items.map((item) => ({
        id: item.id as string,
        bookingId: item.booking_id as string,
        facilityId: item.facility_id as string,
        addonId: (item.addon_id as string) ?? null,
        amountPaise: item.amount_paise as number,
      })),
    };
  }
}