import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../errors/http-error.js';
import type { ApiEnv } from '../config/env.js';
import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface PaymentOrder {
  id: string;
  bookingId: string;
  provider: 'razorpay';
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  status: 'created' | 'paid' | 'failed' | 'expired' | 'refunded';
  createdAt: string;
}

export interface Payment {
  id: string;
  paymentOrderId: string;
  provider: 'razorpay';
  providerPaymentId: string;
  status: 'captured' | 'failed' | 'refunded';
  verifiedAt: string | null;
  createdAt: string;
}

interface PaymentOrderRow {
  id: string;
  booking_id: string;
  provider_order_id: string;
  amount_paise: number;
  currency: string;
  status: PaymentOrder['status'];
  created_at: string;
}

export class PaymentService {
  private razorpay: Razorpay | null = null;

  constructor(
    private supabase: SupabaseClient,
    private env: ApiEnv,
  ) {
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    }
  }

  private requireRazorpay(): Razorpay {
    if (!this.razorpay) {
      throw new HttpError(503, 'PAYMENT_NOT_CONFIGURED', 'Razorpay is not configured.');
    }
    return this.razorpay;
  }

  private generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private signaturesMatch(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(actual, 'utf8');
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  // Provider failures surface as a provider error, never as leaked internals.
  private async callProvider<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(
        502,
        'PAYMENT_PROVIDER_ERROR',
        'The payment provider could not be reached. Please try again.',
      );
    }
  }

  // Creates a Razorpay order for a pending booking. The payable amount always
  // comes from the booking's server-side quoted total; callers never supply it.
  async createOrder(bookingId: string, customerId?: string): Promise<PaymentOrder> {
    const razorpay = this.requireRazorpay();

    const { data: booking, error: bookingError } = await this.supabase
      .from('bookings')
      .select('id, customer_profile_id, quoted_amount_paise, currency, status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    }

    if (customerId && booking.customer_profile_id !== customerId) {
      throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    }

    if (booking.status !== 'pending') {
      throw new HttpError(400, 'BOOKING_INVALID_STATUS', 'Booking is not in a payable state.');
    }

    const amountPaise = booking.quoted_amount_paise as number;
    const currency = booking.currency as string;

    const receipt = `booking_${bookingId.slice(0, 8)}_${Date.now()}`;
    const order = await this.callProvider(() =>
      razorpay.orders.create({
        amount: amountPaise,
        currency,
        receipt,
        notes: {
          booking_id: bookingId,
        },
      }),
    );

    // Store payment order
    const { data: paymentOrder, error } = await this.supabase
      .from('payment_orders')
      .insert({
        booking_id: bookingId,
        provider: 'razorpay',
        provider_order_id: order.id,
        amount_paise: amountPaise,
        currency,
        status: 'created',
      })
      .select()
      .single();

    if (error || !paymentOrder) {
      throw new HttpError(500, 'DATABASE_ERROR', 'Failed to create payment order.');
    }

    return this.formatPaymentOrder(paymentOrder);
  }

  // Confirms a checkout result. The signature proves the result came from
  // Razorpay, and the payment is re-fetched from the provider before the
  // booking is confirmed. A client success flag is never sufficient.
  async verifyPayment(
    providerOrderId: string,
    providerPaymentId: string,
    signature: string,
    customerId?: string,
  ): Promise<Payment> {
    const razorpay = this.requireRazorpay();

    // Razorpay signs payment_id|order_id with the key secret on checkout return.
    const expectedSignature = this.generateSignature(
      `${providerPaymentId}|${providerOrderId}`,
      this.env.RAZORPAY_KEY_SECRET!,
    );

    if (!this.signaturesMatch(expectedSignature, signature)) {
      throw new HttpError(400, 'INVALID_SIGNATURE', 'Payment signature verification failed.');
    }

    // Re-fetch the payment from Razorpay to confirm it independently.
    const payment = await this.callProvider(() => razorpay.payments.fetch(providerPaymentId));

    if (payment.order_id !== providerOrderId) {
      throw new HttpError(400, 'ORDER_MISMATCH', 'Payment does not match order.');
    }

    if (payment.status !== 'captured') {
      throw new HttpError(400, 'PAYMENT_NOT_CAPTURED', `Payment status: ${payment.status}`);
    }

    const { data: paymentOrder, error: orderError } = await this.supabase
      .from('payment_orders')
      .select('*')
      .eq('provider_order_id', providerOrderId)
      .maybeSingle();

    if (orderError) {
      throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch payment order.');
    }
    if (!paymentOrder) {
      throw new HttpError(404, 'PAYMENT_ORDER_NOT_FOUND', 'No payment order found.');
    }
    const orderRow = paymentOrder as PaymentOrderRow;

    // The captured amount must match the server-side quoted amount.
    if (payment.amount !== orderRow.amount_paise || payment.currency !== orderRow.currency) {
      throw new HttpError(400, 'AMOUNT_MISMATCH', 'Payment amount does not match the booking quote.');
    }

    // The booking must belong to the calling customer.
    if (customerId) {
      const { data: booking } = await this.supabase
        .from('bookings')
        .select('customer_profile_id')
        .eq('id', orderRow.booking_id)
        .maybeSingle();

      if (!booking || booking.customer_profile_id !== customerId) {
        throw new HttpError(404, 'PAYMENT_ORDER_NOT_FOUND', 'No payment order found.');
      }
    }

    return this.applyPaymentOutcome(orderRow, providerPaymentId, 'paid', 'captured');
  }

  // Razorpay webhook. Authenticity comes from the HMAC signature over the raw
  // request body using the server-only webhook secret. Processing is
  // idempotent so provider retries are safe.
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    this.requireRazorpay();

    const webhookSecret = this.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new HttpError(503, 'PAYMENT_NOT_CONFIGURED', 'Razorpay webhooks are not configured.');
    }

    const expectedSignature = this.generateSignature(rawBody.toString('utf8'), webhookSecret);
    if (!this.signaturesMatch(expectedSignature, signature)) {
      throw new HttpError(
        400,
        'INVALID_WEBHOOK_SIGNATURE',
        'Webhook signature verification failed.',
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new HttpError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Webhook payload is not valid JSON.');
    }

    const webhookPayload = payload as {
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    const paymentEntity = webhookPayload.payload?.payment?.entity;
    if (!paymentEntity) return;

    const providerOrderId = paymentEntity.order_id;
    const providerPaymentId = paymentEntity.id;
    const paymentStatus = paymentEntity.status;

    if (
      typeof providerOrderId !== 'string' ||
      typeof providerPaymentId !== 'string' ||
      typeof paymentStatus !== 'string'
    ) {
      return;
    }

    const { data: paymentOrder } = await this.supabase
      .from('payment_orders')
      .select('*')
      .eq('provider_order_id', providerOrderId)
      .maybeSingle();

    if (!paymentOrder) {
      // Not an order we created; acknowledge so Razorpay stops retrying.
      return;
    }
    const orderRow = paymentOrder as PaymentOrderRow;

    switch (paymentStatus) {
      case 'captured':
        await this.applyPaymentOutcome(orderRow, providerPaymentId, 'paid', 'captured');
        return;
      case 'failed':
        await this.applyPaymentOutcome(orderRow, providerPaymentId, 'failed', 'failed');
        return;
      case 'refunded':
        await this.applyPaymentOutcome(orderRow, providerPaymentId, 'refunded', 'refunded');
        return;
      default:
        return;
    }
  }

  // Shared, idempotent persistence for verified outcomes: the payment order is
  // updated, the payment record is created or refreshed, and a captured payment
  // confirms the booking. A failed booking update is surfaced so the client can
  // retry; retrying an already applied outcome stays safe.
  private async applyPaymentOutcome(
    paymentOrder: PaymentOrderRow,
    providerPaymentId: string,
    orderStatus: PaymentOrder['status'],
    paymentStatus: Payment['status'],
  ): Promise<Payment> {
    // A paid order is never downgraded by a late or duplicate event.
    const nextOrderStatus =
      paymentOrder.status === 'paid' && orderStatus !== 'paid' ? 'paid' : orderStatus;
    const nextPaymentStatus =
      nextOrderStatus === 'paid' && paymentStatus !== 'captured' ? 'captured' : paymentStatus;

    const { error: orderError } = await this.supabase
      .from('payment_orders')
      .update({ status: nextOrderStatus })
      .eq('id', paymentOrder.id);

    if (orderError) {
      throw new HttpError(500, 'DATABASE_ERROR', 'Failed to update payment order.');
    }

    const { data: existingPayment } = await this.supabase
      .from('payments')
      .select('*')
      .eq('payment_order_id', paymentOrder.id)
      .maybeSingle();

    let paymentRow: Record<string, unknown> | null;
    if (existingPayment) {
      const { data, error } = await this.supabase
        .from('payments')
        .update({
          status: nextPaymentStatus,
          provider_payment_id: providerPaymentId,
          verified_at: new Date().toISOString(),
        })
        .eq('id', (existingPayment as { id: string }).id)
        .select()
        .single();
      if (error || !data) {
        throw new HttpError(500, 'DATABASE_ERROR', 'Failed to update payment record.');
      }
      paymentRow = data as Record<string, unknown>;
    } else {
      const { data, error } = await this.supabase
        .from('payments')
        .insert({
          payment_order_id: paymentOrder.id,
          provider_payment_id: providerPaymentId,
          status: nextPaymentStatus,
          verified_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error || !data) {
        throw new HttpError(500, 'DATABASE_ERROR', 'Failed to create payment record.');
      }
      paymentRow = data as Record<string, unknown>;
    }

    if (nextOrderStatus === 'paid') {
      const { error: bookingError } = await this.supabase
        .from('bookings')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', paymentOrder.booking_id);
      if (bookingError) {
        // The payment itself is verified; surfacing this lets the client
        // retry, and idempotent outcome application makes that retry safe.
        throw new HttpError(
          500,
          'DATABASE_ERROR',
          'Failed to confirm the booking after payment verification.',
        );
      }
    }

    return this.formatPayment(paymentRow);
  }

  async getPaymentOrder(bookingId: string, customerId?: string): Promise<PaymentOrder | null> {
    const query = this.supabase
      .from('payment_orders')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data, error } = await query.maybeSingle();

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch payment order.');
    if (!data) return null;

    // If customerId provided, verify ownership
    if (customerId) {
      const { data: booking } = await this.supabase
        .from('bookings')
        .select('customer_profile_id')
        .eq('id', bookingId)
        .maybeSingle();

      if (!booking || booking.customer_profile_id !== customerId) {
        return null;
      }
    }

    return this.formatPaymentOrder(data);
  }

  async getPayments(paymentOrderId: string): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('payment_order_id', paymentOrderId)
      .order('created_at', { ascending: false });

    if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Failed to fetch payments.');
    return (data ?? []).map((row) => this.formatPayment(row));
  }

  getRazorpayKeyId(): string | null {
    return this.env.RAZORPAY_KEY_ID ?? null;
  }

  private formatPaymentOrder(data: Record<string, unknown>): PaymentOrder {
    return {
      id: data.id as string,
      bookingId: data.booking_id as string,
      provider: 'razorpay' as const,
      providerOrderId: data.provider_order_id as string,
      amountPaise: data.amount_paise as number,
      currency: data.currency as string,
      status: data.status as PaymentOrder['status'],
      createdAt: data.created_at as string,
    };
  }

  private formatPayment(data: Record<string, unknown>): Payment {
    return {
      id: data.id as string,
      paymentOrderId: data.payment_order_id as string,
      provider: 'razorpay' as const,
      providerPaymentId: data.provider_payment_id as string,
      status: data.status as Payment['status'],
      verifiedAt: (data.verified_at as string) ?? null,
      createdAt: data.created_at as string,
    };
  }
}