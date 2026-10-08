import { Router } from 'express';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
} from '../../../../packages/schemas/src/index.js';
import { parseInput } from '../utils/validate.js';
import { currentRequestId } from '../middleware/request-id.js';
import { success } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { PaymentService } from '../services/payment.js';
import { HttpError } from '../errors/http-error.js';

export function createPaymentRoutes(paymentService: PaymentService) {
  const router = Router();

  // Create payment order for a pending booking. The payable amount always comes
  // from the server-side booking quote; the client only sends the booking id.
  router.post('/orders', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required.');
      }

      const input = parseInput(createPaymentOrderSchema, req.body);

      // The service re-reads the booking and derives the authoritative amount.
      // Ownership and payable status are validated before the provider is called.
      const order = await paymentService.createOrder(input.bookingId, req.user.id);
      res.json(success(order, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Get payment order for a booking
  router.get('/orders/booking/:bookingId', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required.');
      }

      const bookingId = Array.isArray(req.params.bookingId)
        ? req.params.bookingId[0]
        : req.params.bookingId;
      if (!bookingId) {
        throw new HttpError(400, 'INVALID_BOOKING_ID', 'Booking ID is required.');
      }
      const order = await paymentService.getPaymentOrder(bookingId, req.user.id);
      if (!order) {
        throw new HttpError(
          404,
          'PAYMENT_ORDER_NOT_FOUND',
          'No payment order found for this booking.',
        );
      }
      res.json(success(order, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Verify payment (called after Razorpay checkout)
  router.post('/verify', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required.');
      }

      const input = parseInput(verifyPaymentSchema, req.body);
      const payment = await paymentService.verifyPayment(
        input.providerOrderId,
        input.providerPaymentId,
        input.signature,
        req.user.id,
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
        throw new HttpError(503, 'PAYMENT_NOT_CONFIGURED', 'Payment is not configured.');
      }
      res.json(success({ keyId }, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

// Razorpay calls this endpoint directly, so it must not sit behind customer
// authentication. Authenticity comes from the Razorpay webhook signature over
// the raw request body, verified with the server-only webhook secret.
export function createPaymentWebhookRoutes(paymentService: PaymentService) {
  const router = Router();

  router.post('/razorpay', async (req: AuthenticatedRequest, res, next) => {
    try {
      const signature = req.header('x-razorpay-signature');
      if (!signature) {
        throw new HttpError(400, 'MISSING_SIGNATURE', 'Missing webhook signature.');
      }

      const rawBody = req.rawBody;
      if (!rawBody || rawBody.length === 0) {
        throw new HttpError(400, 'MISSING_RAW_BODY', 'Missing webhook body.');
      }

      await paymentService.handleWebhook(rawBody, signature);
      res.json(success({ received: true }, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
