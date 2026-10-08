import { Router } from 'express';
import {
  availabilityRequestSchema,
  bookingIdSchema,
  bookingStatusSchema,
  createBookingSchema,
  facilityKeySchema,
  quoteSelectionSchema,
} from '../../../../packages/schemas/src/index.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../errors/http-error.js';
import { requireAuth, requireDomain, type AuthenticatedRequest } from '../middleware/auth.js';
import { currentRequestId } from '../middleware/request-id.js';
import { BookingService, QuoteService } from '../services/booking.js';
import type {
  AvailabilityService,
  FacilitiesService,
  PricingService,
  SchedulesService,
} from '../services/domain.js';
import { success } from '../utils/response.js';
import { parseInput } from '../utils/validate.js';

export function createBookingRoutes(
  supabase: SupabaseClient,
  availabilityService: AvailabilityService,
  pricingService: PricingService,
  facilitiesService: FacilitiesService,
  schedulesService: SchedulesService,
) {
  const router = Router();
  const quoteService = new QuoteService(
    supabase,
    availabilityService,
    pricingService,
    facilitiesService,
  );
  const bookingService = new BookingService(supabase, quoteService);
  const requireCustomer = [requireAuth, requireDomain('customer')] as const;

  router.get('/facilities', async (_req, res, next) => {
    try {
      res.json(success(await facilitiesService.listActive(), currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  router.get('/facilities/:key', async (req, res, next) => {
    try {
      const key = parseInput(facilityKeySchema, req.params.key);
      const facility = await facilitiesService.getByKey(key);
      if (!facility) throw new HttpError(404, 'FACILITY_NOT_FOUND', 'Facility not found.');
      const addons = await facilitiesService.getAddons(facility.id);
      res.json(success({ ...facility, addons }, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  router.get('/facilities/:key/schedule', async (req, res, next) => {
    try {
      const key = parseInput(facilityKeySchema, req.params.key);
      const facility = await facilitiesService.getByKey(key);
      if (!facility) throw new HttpError(404, 'FACILITY_NOT_FOUND', 'Facility not found.');
      res.json(
        success(await schedulesService.getWeeklySchedule(facility.id), currentRequestId(res)),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get('/facilities/:key/pricing', async (req, res, next) => {
    try {
      const key = parseInput(facilityKeySchema, req.params.key);
      const facility = await facilitiesService.getByKey(key);
      if (!facility) throw new HttpError(404, 'FACILITY_NOT_FOUND', 'Facility not found.');
      res.json(success(await pricingService.getAllPricing(facility.id), currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  router.get(
    '/facilities/:key/availability',
    ...requireCustomer,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const input = parseInput(availabilityRequestSchema, {
          facilityKey: req.params.key,
          date: req.query.date,
          durationHours: Number(req.query.durationHours),
          addOnKey: req.query.addOnKey,
        });
        const { facility, addon } = await facilitiesService.validateFacilityAndAddon(
          input.facilityKey,
          input.addOnKey,
        );
        const listing = await availabilityService.listAvailability(
          facility.id,
          input.date,
          input.durationHours,
          addon?.id ?? null,
        );
        res.json(success(listing, currentRequestId(res)));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/bookings/quotes',
    ...requireCustomer,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const input = parseInput(quoteSelectionSchema, req.body);
        const quote = await quoteService.createQuote(input, req.user!.id);
        res.status(201).json(success(quote, currentRequestId(res)));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post('/bookings', ...requireCustomer, async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = parseInput(createBookingSchema, req.body);
      const booking = await bookingService.createBooking(req.user!.id, input);
      res.status(201).json(success(booking, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  router.get('/bookings', ...requireCustomer, async (req: AuthenticatedRequest, res, next) => {
    try {
      const status = req.query.status
        ? parseInput(bookingStatusSchema, req.query.status)
        : undefined;
      res.json(
        success(await bookingService.listBookings(req.user!.id, status), currentRequestId(res)),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get('/bookings/:id', ...requireCustomer, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = parseInput(bookingIdSchema, req.params.id);
      const booking = await bookingService.getBooking(id, req.user!.id);
      if (!booking) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
      res.json(success(booking, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
