import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingDurationHours, FacilityKey } from '@turf-and-taste/types';
import type { QuoteSelection } from '@turf-and-taste/schemas';
import {
  businessDate,
  businessDateTime,
  businessTime,
  quoteSelectionSchema,
} from '@turf-and-taste/schemas';
import { HttpError } from '../errors/http-error.js';
import type { AvailabilityService, FacilitiesService, PricingService } from './domain.js';

export interface Quote {
  id: string;
  facilityKey: FacilityKey;
  facilityId: string;
  addonKey?: 'shooting-machine';
  addonId?: string;
  date: string;
  startTime: string;
  startsAt: string;
  durationHours: BookingDurationHours;
  amountPaise: number;
  currency: string;
  expiresAt: string;
}

export interface CreateBookingInput extends QuoteSelection {
  quoteId: string;
}

export interface BookingItem {
  id: string;
  bookingId: string;
  facilityId: string;
  facilityKey: FacilityKey;
  facilityName: string;
  addonId: string | null;
  addonKey: 'shooting-machine' | null;
  addonName: string | null;
  amountPaise: number;
}

export interface Booking {
  id: string;
  customerProfileId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  startsAt: string;
  durationHours: BookingDurationHours;
  quotedAmountPaise: number;
  currency: string;
  quoteExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  items: BookingItem[];
}

export class QuoteService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly availabilityService: AvailabilityService,
    private readonly pricingService: PricingService,
    private readonly facilitiesService: FacilitiesService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createQuote(selectionInput: QuoteSelection, customerId: string): Promise<Quote> {
    const selection = quoteSelectionSchema.parse(selectionInput);
    const { facility, addon } = await this.facilitiesService.validateFacilityAndAddon(
      selection.facilityKey,
      selection.addOnKey,
    );
    const startsAt = businessDateTime(selection.date, selection.startTime);
    const availability = await this.availabilityService.checkSlotAvailability(
      facility.id,
      selection.date,
      selection.startTime,
      selection.durationHours,
      addon?.id ?? null,
    );
    if (!availability.available) {
      throw new HttpError(
        409,
        'SLOT_UNAVAILABLE',
        availability.reason ?? 'The selected time is no longer available.',
      );
    }
    const price = await this.pricingService.getPrice(
      facility.id,
      addon?.id ?? null,
      selection.durationHours,
      startsAt,
    );
    if (!price)
      throw new HttpError(
        400,
        'PRICING_NOT_FOUND',
        'Pricing is not configured for this selection.',
      );
    const expiresAt = new Date(this.now().getTime() + 15 * 60_000);
    const { data, error } = await this.supabase
      .from('booking_quotes')
      .insert({
        customer_profile_id: customerId,
        facility_id: facility.id,
        facility_key: facility.key,
        addon_id: addon?.id ?? null,
        addon_key: addon?.key ?? null,
        starts_at: startsAt.toISOString(),
        duration_hours: selection.durationHours,
        amount_paise: price.amount_paise,
        currency: price.currency,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();
    if (error || !data) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to create quote.');
    return this.formatQuote(data);
  }

  async getOwnedQuote(quoteId: string, customerId: string): Promise<Quote> {
    const { data, error } = await this.supabase
      .from('booking_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('customer_profile_id', customerId)
      .is('consumed_at', null)
      .maybeSingle();
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to validate quote.');
    if (!data || new Date(data.expires_at) <= this.now()) {
      throw new HttpError(409, 'QUOTE_EXPIRED', 'The quote has expired. Please refresh the price.');
    }
    return this.formatQuote(data);
  }

  private formatQuote(row: Record<string, unknown>): Quote {
    const startsAt = new Date(row.starts_at as string);
    return {
      id: row.id as string,
      facilityKey: row.facility_key as FacilityKey,
      facilityId: row.facility_id as string,
      addonKey: (row.addon_key as 'shooting-machine' | null) ?? undefined,
      addonId: (row.addon_id as string | null) ?? undefined,
      date: businessDate(startsAt),
      startTime: businessTime(startsAt),
      startsAt: startsAt.toISOString(),
      durationHours: row.duration_hours as BookingDurationHours,
      amountPaise: row.amount_paise as number,
      currency: row.currency as string,
      expiresAt: row.expires_at as string,
    };
  }
}

export class BookingService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly quoteService: QuoteService,
  ) {}

  async createBooking(customerId: string, input: CreateBookingInput): Promise<Booking> {
    const quote = await this.quoteService.getOwnedQuote(input.quoteId, customerId);
    const selection = quoteSelectionSchema.parse(input);
    if (
      quote.facilityKey !== selection.facilityKey ||
      quote.date !== selection.date ||
      quote.startTime !== selection.startTime ||
      quote.durationHours !== selection.durationHours ||
      quote.addonKey !== selection.addOnKey
    ) {
      throw new HttpError(409, 'QUOTE_MISMATCH', 'The quote no longer matches this booking.');
    }
    const { data: bookingId, error } = await this.supabase.rpc('create_booking_from_quote', {
      p_customer_profile_id: customerId,
      p_quote_id: quote.id,
    });
    if (error) {
      const message = `${error.message ?? ''}`;
      if (error.code === '23P01' || message.includes('SLOT_CONFLICT')) {
        throw new HttpError(409, 'SLOT_CONFLICT', 'The selected time is no longer available.');
      }
      if (message.includes('QUOTE_EXPIRED') || message.includes('QUOTE_CONSUMED')) {
        throw new HttpError(
          409,
          'QUOTE_EXPIRED',
          'The quote has expired. Please refresh the price.',
        );
      }
      throw new HttpError(500, 'DATABASE_ERROR', 'Failed to create booking.');
    }
    const booking = await this.getBooking(bookingId as string, customerId);
    if (!booking)
      throw new HttpError(500, 'DATABASE_ERROR', 'Created booking could not be loaded.');
    return booking;
  }

  async getBooking(bookingId: string, customerId: string): Promise<Booking | null> {
    const { data, error } = await this.supabase
      .from('bookings')
      .select('*, booking_items(*, facilities(key, name), facility_addons(key, name))')
      .eq('id', bookingId)
      .eq('customer_profile_id', customerId)
      .maybeSingle();
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch booking.');
    return data ? this.formatBooking(data, data.booking_items ?? []) : null;
  }

  async listBookings(customerId: string, status?: Booking['status']): Promise<Booking[]> {
    let query = this.supabase
      .from('bookings')
      .select('*, booking_items(*, facilities(key, name), facility_addons(key, name))')
      .eq('customer_profile_id', customerId)
      .order('starts_at', { ascending: false })
      .limit(100);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch bookings.');
    return (data ?? []).map((row) => this.formatBooking(row, row.booking_items ?? []));
  }

  private formatBooking(
    booking: Record<string, unknown>,
    items: Record<string, unknown>[],
  ): Booking {
    return {
      id: booking.id as string,
      customerProfileId: booking.customer_profile_id as string,
      status: booking.status as Booking['status'],
      startsAt: booking.starts_at as string,
      durationHours: booking.duration_hours as BookingDurationHours,
      quotedAmountPaise: booking.quoted_amount_paise as number,
      currency: booking.currency as string,
      quoteExpiresAt: booking.quote_expires_at as string,
      createdAt: booking.created_at as string,
      updatedAt: booking.updated_at as string,
      items: items.map((item) => {
        const facility = item.facilities as Record<string, unknown>;
        const addon = item.facility_addons as Record<string, unknown> | null;
        return {
          id: item.id as string,
          bookingId: item.booking_id as string,
          facilityId: item.facility_id as string,
          facilityKey: facility.key as FacilityKey,
          facilityName: facility.name as string,
          addonId: (item.addon_id as string | null) ?? null,
          addonKey: (addon?.key as 'shooting-machine' | undefined) ?? null,
          addonName: (addon?.name as string | undefined) ?? null,
          amountPaise: item.amount_paise as number,
        };
      }),
    };
  }
}
