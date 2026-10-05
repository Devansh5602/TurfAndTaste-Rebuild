import { Router } from 'express';
import { z } from 'zod';
import { parseInput } from '../utils/validate';
import { currentRequestId } from '../middleware/request-id';
import { success } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth';
import { QuoteService, BookingService } from '../services/booking';
import type { AvailabilityService } from '../services/domain';
import type { PricingService, FacilitiesService, SchedulesService } from '../services/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuoteSelection } from '@turf-and-taste/schemas';
import type { FacilityKey } from '@turf-and-taste/types';

export function createBookingRoutes(
  supabase: SupabaseClient,
  availabilityService: AvailabilityService,
  pricingService: PricingService,
  facilitiesService: FacilitiesService,
  schedulesService: SchedulesService,
) {
  const router = Router();
  const quoteService = new QuoteService(availabilityService, pricingService);
  const bookingService = new BookingService(supabase, quoteService, availabilityService);

  // Set supabase on availability service for direct queries
  availabilityService.setSupabase(supabase);

  // Get all active facilities
  router.get('/facilities', async (_req: AuthenticatedRequest, res, next) => {
    try {
      const facilities = await facilitiesService.listActive();
      res.json(success(facilities, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Get facility details with add-ons
  router.get('/facilities/:key', async (req: AuthenticatedRequest, res, next) => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const facility = await facilitiesService.getByKey(key as FacilityKey);
      if (!facility) {
        return res.status(404).json(success(null, currentRequestId(res)));
      }
      const addons = await facilitiesService.getAddons(facility.id);
      res.json(success({ ...facility, addons }, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Get facility schedule
  router.get('/facilities/:key/schedule', async (req: AuthenticatedRequest, res, next) => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const facility = await facilitiesService.getByKey(key as FacilityKey);
      if (!facility) {
        return res.status(404).json(success(null, currentRequestId(res)));
      }
      const schedule = await schedulesService.getWeeklySchedule(facility.id);
      res.json(success(schedule, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Get pricing for a facility
  router.get('/facilities/:key/pricing', async (req: AuthenticatedRequest, res, next) => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const facility = await facilitiesService.getByKey(key as FacilityKey);
      if (!facility) {
        return res.status(404).json(success(null, currentRequestId(res)));
      }
      const pricing = await pricingService.getAllPricing(facility.id);
      res.json(success(pricing, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Check slot availability
  const checkAvailabilitySchema = z.object({
    facilityKey: z.enum(['box-cricket', 'skating-rink', 'pickle-ball', 'cricket-green-net']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    durationHours: z.union([z.literal(1), z.literal(2)]),
    addonKey: z.enum(['shooting-machine']).optional(),
  });

  router.post('/availability/check', async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = parseInput(checkAvailabilitySchema, req.body);
      const facility = await facilitiesService.getByKey(input.facilityKey);
      if (!facility) {
        return res.status(400).json(success({ available: false, reason: 'Invalid facility' }, currentRequestId(res)));
      }

      const addonId = input.addonKey
        ? await facilitiesService.getAddons(facility.id).then(addons => 
            addons.find(a => a.key === input.addonKey)?.id ?? null
          )
        : null;

      const date = new Date(input.date + 'T00:00:00+05:30');
      const availability = await availabilityService.checkSlotAvailability(
        facility.id,
        date,
        input.startTime,
        input.durationHours,
        addonId,
      );

      res.json(success(availability, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Create quote
  const quoteSchema = z.object({
    facilityKey: z.enum(['box-cricket', 'skating-rink', 'pickle-ball', 'cricket-green-net']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    durationHours: z.union([z.literal(1), z.literal(2)]),
    addOnKey: z.enum(['shooting-machine']).optional(),
  });

  router.post('/quotes', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        return res.status(401).json(success(null, currentRequestId(res)));
      }

      const input = parseInput(quoteSchema, req.body);
      const selection: QuoteSelection = {
        facilityKey: input.facilityKey,
        addOnKey: input.addOnKey,
        date: input.date,
        startTime: input.startTime,
        durationHours: input.durationHours,
      };

      const quote = await quoteService.createQuote(selection, req.user.id);
      res.json(success(quote, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Create booking from quote
  const bookingSchema = z.object({
    facilityKey: z.enum(['box-cricket', 'skating-rink', 'pickle-ball', 'cricket-green-net']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    durationHours: z.union([z.literal(1), z.literal(2)]),
    addOnKey: z.enum(['shooting-machine']).optional(),
    quoteId: z.string().uuid(),
  });

  router.post('/bookings', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        return res.status(401).json(success(null, currentRequestId(res)));
      }

      const input = parseInput(bookingSchema, req.body);
      const booking = await bookingService.createBooking(req.user.id, input);
      res.status(201).json(success(booking, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Get customer's bookings
  router.get('/bookings', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        return res.status(401).json(success(null, currentRequestId(res)));
      }

      const status = req.query.status as string | undefined;
      const bookings = await bookingService.listBookings(req.user.id, status);
      res.json(success(bookings, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Get specific booking
  router.get('/bookings/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        return res.status(401).json(success(null, currentRequestId(res)));
      }

      const bookingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!bookingId) {
        return res.status(400).json(success(null, currentRequestId(res)));
      }
      const booking = await bookingService.getBooking(bookingId, req.user.id);
      if (!booking) {
        return res.status(404).json(success(null, currentRequestId(res)));
      }

      res.json(success(booking, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Cancel booking
  router.post('/bookings/:id/cancel', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        return res.status(401).json(success(null, currentRequestId(res)));
      }

      const bookingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!bookingId) {
        return res.status(400).json(success(null, currentRequestId(res)));
      }
      const booking = await bookingService.cancelBooking(bookingId, req.user.id);
      res.json(success(booking, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}