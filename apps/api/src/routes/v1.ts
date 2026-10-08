import { Router } from 'express';
import type { ApiEnv } from '../config/env.js';
import { createAuthMiddleware, requireAuth, requireDomain } from '../middleware/auth.js';
import { createBookingRoutes } from './booking.js';
import { createPaymentRoutes, createPaymentWebhookRoutes } from './payment.js';
import { createProfileRoutes } from './profile.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AvailabilityService } from '../services/domain.js';
import { PricingService, FacilitiesService, SchedulesService } from '../services/domain.js';
import { PaymentService } from '../services/payment.js';

export function createV1Router(env: ApiEnv, supabase: SupabaseClient) {
  const router = Router();

  // Apply auth middleware to all v1 routes
  router.use(createAuthMiddleware(env));

  // Initialize services
  const facilitiesService = new FacilitiesService(supabase);
  const schedulesService = new SchedulesService(supabase);
  const pricingService = new PricingService(supabase);
  const availabilityService = new AvailabilityService(supabase, schedulesService, pricingService);
  const paymentService = new PaymentService(supabase, env);

  router.use(
    '/',
    createBookingRoutes(
      supabase,
      availabilityService,
      pricingService,
      facilitiesService,
      schedulesService,
    ),
  );

  // The Razorpay webhook authenticates with a provider signature over the raw
  // body, not with a customer session, so it stays outside the auth guards.
  router.use('/payments/webhook', createPaymentWebhookRoutes(paymentService));

  // Protected customer routes
  router.use('/profile', requireAuth, requireDomain('customer'), createProfileRoutes(supabase));
  router.use(
    '/payments',
    requireAuth,
    requireDomain('customer'),
    createPaymentRoutes(paymentService),
  );

  return router;
}
