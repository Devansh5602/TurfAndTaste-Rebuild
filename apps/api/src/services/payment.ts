import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../errors/http-error';
import type { ApiEnv } from '../config/env';
import Razorpay from 'razorpay';
import { createHmac } from 'node:crypto';

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

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
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

  private generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  async createOrder(bookingId: string, amountPaise: number, currency: string = 'INR'): Promise<PaymentOrder> {
    if (!this.razorpay) {
      throw new HttpError(500, 'PAYMENT_NOT_CONFIGURED', 'Razorpay is not configured.');
    }

    // Verify booking exists and get details
    const { data: booking, error: bookingError } = await this.supabase
      .from('bookings')
      .select('id, customer_profile_id, quoted_amount_paise, currency, status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    }

    if (booking.status !== 'pending') {
      throw new HttpError(400, 'BOOKING_INVALID_STATUS', 'Booking is not in a payable state.');
    }

    // Verify amount matches quoted amount
    if (booking.quoted_amount_paise !== amountPaise || booking.currency !== currency) {
      throw new HttpError(400, 'AMOUNT_MISMATCH', 'Payment amount does not match booking quote.');
    }

    // Create Razorpay order
    const receipt = `booking_${bookingId.slice(0, 8)}_${Date.now()}`;
    const order = await this.razorpay.orders.create({
      amount: amountPaise,
      currency,
      receipt,
      notes: {
        booking_id: bookingId,
      },
    });

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

  async verifyPayment(
    providerOrderId: string,
    providerPaymentId: string,
    signature: string,
  ): Promise<Payment> {
    if (!this.razorpay) {
      throw new HttpError(500, 'PAYMENT_NOT_CONFIGURED', 'Razorpay is not configured.');
    }

    // Verify signature - Razorpay uses HMAC SHA256 of the payment_id + "|" + order_id
    const expectedSignature = this.generateSignature(`${providerPaymentId}|${providerOrderId}`, this.env.RAZORPAY_KEY_SECRET!);

    if (expectedSignature !== signature) {
      throw new HttpError(400, 'INVALID_SIGNATURE', 'Payment signature verification failed.');
    }

    // Fetch payment from Razorpay to confirm
    const payment = await this.razorpay.payments.fetch(providerPaymentId);

    if (payment.order_id !== providerOrderId) {
      throw new HttpError(400, 'ORDER_MISMATCH', 'Payment does not match order.');
    }

    if (payment.status !== 'captured') {
      throw new HttpError(400, 'PAYMENT_NOT_CAPTURED', `Payment status: ${payment.status}`);
    }

    // Update payment order and create payment record
    const { data: paymentOrder, error: orderError } = await this.supabase
      .from('payment_orders')
      .update({ status: 'paid' })
      .eq('provider_order_id', providerOrderId)
      .select()
      .single();

    if (orderError || !paymentOrder) {
      throw new HttpError(500, 'DATABASE_ERROR', 'Failed to update payment order.');
    }

    // Create payment record
    const { data: paymentRecord, error: paymentError } = await this.supabase
      .from('payments')
      .insert({
        payment_order_id: paymentOrder.id,
        provider_payment_id: providerPaymentId,
        status: 'captured',
        verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError || !paymentRecord) {
      throw new HttpError(500, 'DATABASE_ERROR', 'Failed to create payment record.');
    }

    // Update booking status to confirmed
    const { error: bookingError } = await this.supabase
      .from('bookings')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', paymentOrder.booking_id);

    if (bookingError) {
      // Log error but don't fail - payment is verified
      // eslint-disable-next-line no-console
      console.error('Failed to update booking status:', bookingError);
    }

    return this.formatPayment(paymentRecord);
  }

  async handleWebhook(payload: unknown, signature: string): Promise<void> {
    if (!this.razorpay) {
      throw new HttpError(500, 'PAYMENT_NOT_CONFIGURED', 'Razorpay is not configured.');
    }

    // Verify webhook signature
    const expectedSignature = this.generateSignature(JSON.stringify(payload), this.env.RAZORPAY_KEY_SECRET!);

    if (expectedSignature !== signature) {
      throw new HttpError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed.');
    }

    // Handle different event types
    const webhookPayload = payload as { payload?: { payment?: { entity?: Record<string, unknown> } } };
    const paymentEntity = webhookPayload.payload?.payment?.entity;

    if (!paymentEntity) return;

    const providerOrderId = paymentEntity.order_id;
    const providerPaymentId = paymentEntity.id;
    const paymentStatus = paymentEntity.status;

    // Find payment order
    const { data: paymentOrder } = await this.supabase
      .from('payment_orders')
      .select('*')
      .eq('provider_order_id', providerOrderId)
      .maybeSingle();

    if (!paymentOrder) {
      // eslint-disable-next-line no-console
      console.warn('Payment order not found for webhook:', providerOrderId);
      return;
    }

    // Update based on status
    let newOrderStatus: PaymentOrder['status'] = 'created';
    let paymentRecordStatus: Payment['status'] = 'captured';

    switch (paymentStatus) {
      case 'captured':
        newOrderStatus = 'paid';
        paymentRecordStatus = 'captured';
        break;
      case 'failed':
        newOrderStatus = 'failed';
        paymentRecordStatus = 'failed';
        break;
      case 'refunded':
        newOrderStatus = 'refunded';
        paymentRecordStatus = 'refunded';
        break;
      default:
        return;
    }

    // Update payment order
    await this.supabase
      .from('payment_orders')
      .update({ status: newOrderStatus })
      .eq('id', paymentOrder.id);

    // Create or update payment record
    const { data: existingPayment } = await this.supabase
      .from('payments')
      .select('*')
      .eq('payment_order_id', paymentOrder.id)
      .maybeSingle();

    if (existingPayment) {
      await this.supabase
        .from('payments')
        .update({ status: paymentRecordStatus, verified_at: new Date().toISOString() })
        .eq('id', existingPayment.id);
    } else {
      await this.supabase
        .from('payments')
        .insert({
          payment_order_id: paymentOrder.id,
          provider_payment_id: providerPaymentId,
          status: paymentRecordStatus,
          verified_at: new Date().toISOString(),
        });
    }

    // Update booking status
    if (newOrderStatus === 'paid') {
      await this.supabase
        .from('bookings')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', paymentOrder.booking_id);
    }
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
    return (data ?? []).map(this.formatPayment);
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