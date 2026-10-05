import { Router } from 'express';
import type { ApiEnv } from '../config/env';
import { createAuthMiddleware, requireAuth, requireDomain } from '../middleware/auth';
import { createBookingRoutes } from './booking';
import { createPaymentRoutes } from './payment';
import { createProfileRoutes } from './profile';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AvailabilityService } from '../services/domain';
import { PricingService, FacilitiesService, SchedulesService } from '../services/domain';
import { PaymentService } from '../services/payment';

export function createV1Router(env: ApiEnv, supabase: SupabaseClient) {
  const router = Router();

  // Apply auth middleware to all v1 routes
  router.use(createAuthMiddleware(env));

  // Initialize services
  const facilitiesService = new FacilitiesService(supabase);
  const schedulesService = new SchedulesService(supabase);
  const pricingService = new PricingService(supabase);
  const availabilityService = new AvailabilityService(schedulesService, pricingService);
  const paymentService = new PaymentService(supabase, env);

  // Public routes (no auth required) - facilities, schedules, pricing
  router.use('/facilities', createBookingRoutes(supabase, availabilityService, pricingService, facilitiesService, schedulesService));

  // Protected customer routes
  router.use('/profile', requireAuth, requireDomain('customer'), createProfileRoutes(supabase));
  router.use('/bookings', requireAuth, requireDomain('customer'), createBookingRoutes(supabase, availabilityService, pricingService, facilitiesService, schedulesService));
  router.use('/payments', requireAuth, requireDomain('customer'), createPaymentRoutes(supabase, paymentService));

  return router;
}