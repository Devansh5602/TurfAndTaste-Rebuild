import { Router } from 'express';
import { z } from 'zod';
import { parseInput } from '../utils/validate';
import { currentRequestId } from '../middleware/request-id';
import { success } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth';
import type { PaymentService } from '../services/payment';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createPaymentRoutes(
  supabase: SupabaseClient,
  paymentService: PaymentService,
) {
  const router = Router();

  // Create payment order for a booking
  const createOrderSchema = z.object({
    bookingId: z.string().uuid(),
    amountPaise: z.number().int().positive(),
    currency: z.string().default('INR'),
  });

  router.post('/orders', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        return res.status(401).json(success(null, currentRequestId(res)));
      }

      const input = parseInput(createOrderSchema, req.body);

      // Verify booking belongs to customer
      const { data: booking } = await supabase
        .from('bookings')
        .select('customer_profile_id, status, quoted_amount_paise, currency')
        .eq('id', input.bookingId)
        .maybeSingle();

      if (!booking || booking.customer_profile_id !== req.user.id) {
        return res.status(404).json(success(null, currentRequestId(res)));
      }

      if (booking.status !== 'pending') {
        return res.status(400).json(success({ error: 'Booking not in payable state' }, currentRequestId(res)));
      }

      const order = await paymentService.createOrder(input.bookingId, input.amountPaise, input.currency);
      res.json(success(order, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Get payment order for a booking
  router.get('/orders/booking/:bookingId', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        return res.status(401).json(success(null, currentRequestId(res)));
      }

      const bookingId = Array.isArray(req.params.bookingId) ? req.params.bookingId[0] : req.params.bookingId;
      if (!bookingId) {
        return res.status(400).json(success(null, currentRequestId(res)));
      }
      const order = await paymentService.getPaymentOrder(bookingId, req.user.id);
      res.json(success(order, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Verify payment (called after Razorpay checkout)
  const verifySchema = z.object({
    providerOrderId: z.string(),
    providerPaymentId: z.string(),
    signature: z.string(),
  });

  router.post('/verify', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        return res.status(401).json(success(null, currentRequestId(res)));
      }

      const input = parseInput(verifySchema, req.body);
      const payment = await paymentService.verifyPayment(
        input.providerOrderId,
        input.providerPaymentId,
        input.signature,
      );

      res.json(success(payment, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Get Razorpay key ID for client checkout
  router.get('/razorpay/key', async (_req: AuthenticatedRequest, res, next) => {
    try {
      const keyId = paymentService.getRazorpayKeyId();
      if (!keyId) {
        return res.status(503).json(success({ error: 'Payment not configured' }, currentRequestId(res)));
      }
      res.json(success({ keyId }, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Razorpay webhook
  router.post('/webhook/razorpay', async (req: AuthenticatedRequest, res, next) => {
    try {
      const signature = req.header('x-razorpay-signature');
      if (!signature) {
        return res.status(400).json(success({ error: 'Missing signature' }, currentRequestId(res)));
      }

      await paymentService.handleWebhook(req.body, signature);
      res.json(success({ received: true }, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}