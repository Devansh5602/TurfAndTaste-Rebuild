import { Router } from 'express';
import type { ApiEnv } from '../config/env';
import { createAuthMiddleware, requireAuth, requireDomain } from '../middleware/auth';
import { createBookingRoutes } from './booking';
import { createPaymentRoutes, createPaymentWebhookRoutes } from './payment';
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
