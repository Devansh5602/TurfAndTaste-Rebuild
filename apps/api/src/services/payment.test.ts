import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from '../config/env';
import { PaymentService } from './payment';

const { ordersCreateMock, paymentsFetchMock } = vi.hoisted(() => ({
  ordersCreateMock: vi.fn(),
  paymentsFetchMock: vi.fn(),
}));

vi.mock('razorpay', () => ({
  default: class RazorpayMock {
    orders = { create: ordersCreateMock };
    payments = { fetch: paymentsFetchMock };
  },
}));

const env = {
  NODE_ENV: 'test',
  RAZORPAY_KEY_ID: 'rzp_test_key',
  RAZORPAY_KEY_SECRET: 'test_key_secret',
  RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
} as ApiEnv;

interface MockResult {
  data: unknown;
  error: unknown;
}

function ok(data: unknown): MockResult {
  return { data, error: null };
}

// Chainable supabase stub: each from(table) call consumes the next queued
// result for that table; the last result repeats when the queue is exhausted.
function createSupabaseMock(queues: Record<string, MockResult[]>) {
  const cursors: Record<string, number> = {};
  const calls: Array<{ table: string; op: 'insert' | 'update'; payload: unknown }> = [];

  const from = vi.fn((table: string) => {
    const queue = queues[table] ?? [];
    const cursor = cursors[table] ?? 0;
    const result: MockResult =
      queue.length === 0 ? ok(null) : (queue[Math.min(cursor, queue.length - 1)] ?? ok(null));
    cursors[table] = cursor + 1;

    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'order', 'limit']) {
      builder[method] = () => builder;
    }
    builder.insert = (payload: unknown) => {
      calls.push({ table, op: 'insert', payload });
      return builder;
    };
    builder.update = (payload: unknown) => {
      calls.push({ table, op: 'update', payload });
      return builder;
    };
    builder.single = () => builder;
    builder.maybeSingle = () => builder;
    builder.then = (
      onFulfilled?: (value: MockResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return builder;
  });

  return { supabase: { from } as never, calls };
}

const bookingId = '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66';
const providerOrderId = 'order_abc';
const providerPaymentId = 'pay_abc';

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: bookingId,
    customer_profile_id: 'customer-1',
    quoted_amount_paise: 50000,
    currency: 'INR',
    status: 'pending',
    ...overrides,
  };
}

function paymentOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-order-1',
    booking_id: bookingId,
    provider: 'razorpay',
    provider_order_id: providerOrderId,
    amount_paise: 50000,
    currency: 'INR',
    status: 'created',
    created_at: '2026-10-07T10:00:00.000Z',
    ...overrides,
  };
}

function checkoutSignature(orderId: string, paymentId: string): string {
  return createHmac('sha256', 'test_key_secret').update(`${orderId}|${paymentId}`).digest('hex');
}

beforeEach(() => {
  ordersCreateMock.mockReset();
  paymentsFetchMock.mockReset();
  ordersCreateMock.mockResolvedValue({ id: providerOrderId, amount: 50000, currency: 'INR' });
  paymentsFetchMock.mockResolvedValue({
    id: providerPaymentId,
    order_id: providerOrderId,
    status: 'captured',
    amount: 50000,
    currency: 'INR',
  });
});

describe('PaymentService.createOrder', () => {
  it('charges the server-side quoted amount for the owning customer', async () => {
    const { supabase, calls } = createSupabaseMock({
      bookings: [ok(bookingRow())],
      payment_orders: [ok({ ...paymentOrderRow(), status: 'created' })],
    });
    const service = new PaymentService(supabase, env);

    const order = await service.createOrder(bookingId, 'customer-1');

    expect(ordersCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50000, currency: 'INR' }),
    );
    expect(calls).toContainEqual({
      table: 'payment_orders',
      op: 'insert',
      payload: expect.objectContaining({ amount_paise: 50000, booking_id: bookingId }),
    });
    expect(order).toMatchObject({ bookingId, amountPaise: 50000, status: 'created' });
  });

  it('refuses a booking owned by another customer', async () => {
    const { supabase } = createSupabaseMock({ bookings: [ok(bookingRow())] });
    const service = new PaymentService(supabase, env);

    await expect(service.createOrder(bookingId, 'someone-else')).rejects.toMatchObject({
      status: 404,
      code: 'BOOKING_NOT_FOUND',
    });
    expect(ordersCreateMock).not.toHaveBeenCalled();
  });

  it('refuses a booking that is not pending', async () => {
    const { supabase } = createSupabaseMock({
      bookings: [ok(bookingRow({ status: 'confirmed' }))],
    });
    const service = new PaymentService(supabase, env);

    await expect(service.createOrder(bookingId, 'customer-1')).rejects.toMatchObject({
      status: 400,
      code: 'BOOKING_INVALID_STATUS',
    });
    expect(ordersCreateMock).not.toHaveBeenCalled();
  });

  it('maps provider failures to a provider error', async () => {
    ordersCreateMock.mockRejectedValue(new Error('socket hang up'));
    const { supabase } = createSupabaseMock({ bookings: [ok(bookingRow())] });
    const service = new PaymentService(supabase, env);

    await expect(service.createOrder(bookingId, 'customer-1')).rejects.toMatchObject({
      status: 502,
      code: 'PAYMENT_PROVIDER_ERROR',
    });
  });

  it('fails closed when Razorpay is not configured', async () => {
    const { supabase } = createSupabaseMock({});
    const service = new PaymentService(supabase, { NODE_ENV: 'test' } as ApiEnv);

    await expect(service.createOrder(bookingId, 'customer-1')).rejects.toMatchObject({
      status: 503,
      code: 'PAYMENT_NOT_CONFIGURED',
    });
  });
});

describe('PaymentService.verifyPayment', () => {
  it('rejects a signature that Razorpay did not sign', async () => {
    const { supabase, calls } = createSupabaseMock({});
    const service = new PaymentService(supabase, env);

    await expect(
      service.verifyPayment(providerOrderId, providerPaymentId, 'forged-signature', 'customer-1'),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_SIGNATURE' });
    expect(paymentsFetchMock).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it('confirms the booking only after a captured payment with a matching amount', async () => {
    const { supabase, calls } = createSupabaseMock({
      payment_orders: [ok(paymentOrderRow()), ok({ error: null, data: null })],
      bookings: [ok({ customer_profile_id: 'customer-1' }), ok(null)],
      payments: [
        ok(null),
        ok({
          id: 'payment-1',
          payment_order_id: 'payment-order-1',
          provider_payment_id: providerPaymentId,
          status: 'captured',
          verified_at: '2026-10-07T10:05:00.000Z',
          created_at: '2026-10-07T10:05:00.000Z',
        }),
      ],
    });
    const service = new PaymentService(supabase, env);

    const payment = await service.verifyPayment(
      providerOrderId,
      providerPaymentId,
      checkoutSignature(providerOrderId, providerPaymentId),
      'customer-1',
    );

    expect(paymentsFetchMock).toHaveBeenCalledWith(providerPaymentId);
    expect(calls).toContainEqual({
      table: 'payment_orders',
      op: 'update',
      payload: { status: 'paid' },
    });
    expect(calls).toContainEqual({
      table: 'payments',
      op: 'insert',
      payload: expect.objectContaining({ status: 'captured' }),
    });
    expect(calls).toContainEqual({
      table: 'bookings',
      op: 'update',
      payload: expect.objectContaining({ status: 'confirmed' }),
    });
    expect(payment).toMatchObject({ status: 'captured', providerPaymentId });
  });

  it('rejects a checkout result whose payment belongs to a different order', async () => {
    paymentsFetchMock.mockResolvedValue({
      id: providerPaymentId,
      order_id: 'order_someone_else',
      status: 'captured',
      amount: 50000,
      currency: 'INR',
    });
    const { supabase, calls } = createSupabaseMock({});
    const service = new PaymentService(supabase, env);

    await expect(
      service.verifyPayment(
        providerOrderId,
        providerPaymentId,
        checkoutSignature(providerOrderId, providerPaymentId),
        'customer-1',
      ),
    ).rejects.toMatchObject({ status: 400, code: 'ORDER_MISMATCH' });
    expect(calls).toHaveLength(0);
  });

  it('never confirms a booking for a payment the provider has not captured', async () => {
    paymentsFetchMock.mockResolvedValue({
      id: providerPaymentId,
      order_id: providerOrderId,
      status: 'authorized',
      amount: 50000,
      currency: 'INR',
    });
    const { supabase, calls } = createSupabaseMock({});
    const service = new PaymentService(supabase, env);

    await expect(
      service.verifyPayment(
        providerOrderId,
        providerPaymentId,
        checkoutSignature(providerOrderId, providerPaymentId),
        'customer-1',
      ),
    ).rejects.toMatchObject({ status: 400, code: 'PAYMENT_NOT_CAPTURED' });
    expect(calls.filter((call) => call.table === 'bookings')).toHaveLength(0);
  });

  it('rejects a captured payment whose amount differs from the booking quote', async () => {
    paymentsFetchMock.mockResolvedValue({
      id: providerPaymentId,
      order_id: providerOrderId,
      status: 'captured',
      amount: 1,
      currency: 'INR',
    });
    const { supabase, calls } = createSupabaseMock({
      payment_orders: [ok(paymentOrderRow())],
    });
    const service = new PaymentService(supabase, env);

    await expect(
      service.verifyPayment(
        providerOrderId,
        providerPaymentId,
        checkoutSignature(providerOrderId, providerPaymentId),
        'customer-1',
      ),
    ).rejects.toMatchObject({ status: 400, code: 'AMOUNT_MISMATCH' });
    expect(calls.filter((call) => call.table === 'bookings')).toHaveLength(0);
  });

  it('rejects verification for a booking owned by another customer', async () => {
    const { supabase } = createSupabaseMock({
      payment_orders: [ok(paymentOrderRow())],
      bookings: [ok({ customer_profile_id: 'customer-1' })],
    });
    const service = new PaymentService(supabase, env);

    await expect(
      service.verifyPayment(
        providerOrderId,
        providerPaymentId,
        checkoutSignature(providerOrderId, providerPaymentId),
        'someone-else',
      ),
    ).rejects.toMatchObject({ status: 404, code: 'PAYMENT_ORDER_NOT_FOUND' });
  });

  it('treats a repeated verification as a success, not a duplicate payment', async () => {
    const existingPayment = {
      id: 'payment-1',
      payment_order_id: 'payment-order-1',
      provider_payment_id: providerPaymentId,
      status: 'captured',
      verified_at: '2026-10-07T10:05:00.000Z',
      created_at: '2026-10-07T10:05:00.000Z',
    };
    const { supabase, calls } = createSupabaseMock({
      payment_orders: [ok(paymentOrderRow({ status: 'paid' })), ok(null)],
      bookings: [ok({ customer_profile_id: 'customer-1' }), ok(null)],
      payments: [ok(existingPayment), ok(existingPayment)],
    });
    const service = new PaymentService(supabase, env);

    const payment = await service.verifyPayment(
      providerOrderId,
      providerPaymentId,
      checkoutSignature(providerOrderId, providerPaymentId),
      'customer-1',
    );

    expect(calls.filter((call) => call.table === 'payments' && call.op === 'insert')).toHaveLength(
      0,
    );
    expect(payment).toMatchObject({ id: 'payment-1', status: 'captured' });
  });
});

describe('PaymentService.handleWebhook', () => {
  function webhookPayload(status: string) {
    return {
      payload: {
        payment: {
          entity: { id: providerPaymentId, order_id: providerOrderId, status },
        },
      },
    };
  }

  function webhookSignature(rawBody: Buffer, secret = 'test_webhook_secret'): string {
    return createHmac('sha256', secret).update(rawBody).digest('hex');
  }

  it('rejects a signature that was not computed over the raw body', async () => {
    const rawBody = Buffer.from(JSON.stringify(webhookPayload('captured')));
    const forged = webhookSignature(Buffer.from('different bytes'));
    const { supabase, calls } = createSupabaseMock({});
    const service = new PaymentService(supabase, env);

    await expect(service.handleWebhook(rawBody, forged)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_WEBHOOK_SIGNATURE',
    });
    expect(calls).toHaveLength(0);
  });

  it('confirms the booking when the provider reports a captured payment', async () => {
    const rawBody = Buffer.from(JSON.stringify(webhookPayload('captured')));
    const { supabase, calls } = createSupabaseMock({
      payment_orders: [ok(paymentOrderRow()), ok(null)],
      payments: [
        ok(null),
        ok({
          id: 'payment-1',
          payment_order_id: 'payment-order-1',
          provider_payment_id: providerPaymentId,
          status: 'captured',
          verified_at: '2026-10-07T10:06:00.000Z',
          created_at: '2026-10-07T10:06:00.000Z',
        }),
      ],
      bookings: [ok(null)],
    });
    const service = new PaymentService(supabase, env);

    await service.handleWebhook(rawBody, webhookSignature(rawBody));

    expect(calls).toContainEqual({
      table: 'bookings',
      op: 'update',
      payload: expect.objectContaining({ status: 'confirmed' }),
    });
    expect(calls).toContainEqual({
      table: 'payments',
      op: 'insert',
      payload: expect.objectContaining({ status: 'captured' }),
    });
  });

  it('acknowledges events for orders it never created without writing', async () => {
    const rawBody = Buffer.from(JSON.stringify(webhookPayload('captured')));
    const { supabase, calls } = createSupabaseMock({ payment_orders: [ok(null)] });
    const service = new PaymentService(supabase, env);

    await expect(
      service.handleWebhook(rawBody, webhookSignature(rawBody)),
    ).resolves.toBeUndefined();
    expect(calls.filter((call) => call.op !== undefined)).toHaveLength(0);
  });

  it('does not confirm a booking when the provider reports a failed payment', async () => {
    const rawBody = Buffer.from(JSON.stringify(webhookPayload('failed')));
    const { supabase, calls } = createSupabaseMock({
      payment_orders: [ok(paymentOrderRow()), ok(null)],
      payments: [
        ok(null),
        ok({
          id: 'payment-1',
          payment_order_id: 'payment-order-1',
          provider_payment_id: providerPaymentId,
          status: 'failed',
          verified_at: '2026-10-07T10:06:00.000Z',
          created_at: '2026-10-07T10:06:00.000Z',
        }),
      ],
    });
    const service = new PaymentService(supabase, env);

    await service.handleWebhook(rawBody, webhookSignature(rawBody));

    expect(calls).toContainEqual({
      table: 'payment_orders',
      op: 'update',
      payload: { status: 'failed' },
    });
    expect(calls.filter((call) => call.table === 'bookings')).toHaveLength(0);
  });

  it('applies a repeated captured webhook without creating a second payment', async () => {
    const rawBody = Buffer.from(JSON.stringify(webhookPayload('captured')));
    const recordedPayment = {
      id: 'payment-1',
      payment_order_id: 'payment-order-1',
      provider_payment_id: providerPaymentId,
      status: 'captured',
      verified_at: '2026-10-07T10:05:00.000Z',
      created_at: '2026-10-07T10:05:00.000Z',
    };
    const { supabase, calls } = createSupabaseMock({
      payment_orders: [
        ok(paymentOrderRow()),
        ok(null),
        ok(paymentOrderRow({ status: 'paid' })),
        ok(null),
      ],
      payments: [ok(null), ok(recordedPayment), ok(recordedPayment), ok(recordedPayment)],
      bookings: [ok(null), ok(null)],
    });
    const service = new PaymentService(supabase, env);

    await service.handleWebhook(rawBody, webhookSignature(rawBody));
    await service.handleWebhook(rawBody, webhookSignature(rawBody));

    expect(calls.filter((call) => call.table === 'payments' && call.op === 'insert')).toHaveLength(
      1,
    );
    expect(calls).toContainEqual({
      table: 'payment_orders',
      op: 'update',
      payload: { status: 'paid' },
    });
  });

  it('keeps the confirmed booking intact when the webhook follows the callback', async () => {
    const rawBody = Buffer.from(JSON.stringify(webhookPayload('captured')));
    const recordedPayment = {
      id: 'payment-1',
      payment_order_id: 'payment-order-1',
      provider_payment_id: providerPaymentId,
      status: 'captured',
      verified_at: '2026-10-07T10:05:00.000Z',
      created_at: '2026-10-07T10:05:00.000Z',
    };
    const { supabase, calls } = createSupabaseMock({
      payment_orders: [ok(paymentOrderRow({ status: 'paid' })), ok(null)],
      payments: [ok(recordedPayment), ok(recordedPayment)],
      bookings: [ok(null)],
    });
    const service = new PaymentService(supabase, env);

    await service.handleWebhook(rawBody, webhookSignature(rawBody));

    expect(calls).toContainEqual({
      table: 'payment_orders',
      op: 'update',
      payload: { status: 'paid' },
    });
    expect(calls.filter((call) => call.table === 'payments' && call.op === 'insert')).toHaveLength(
      0,
    );
    expect(calls).toContainEqual({
      table: 'bookings',
      op: 'update',
      payload: expect.objectContaining({ status: 'confirmed' }),
    });
  });

  it('fails closed when no webhook secret is configured', async () => {
    const rawBody = Buffer.from(JSON.stringify(webhookPayload('captured')));
    const { supabase } = createSupabaseMock({});
    const service = new PaymentService(supabase, {
      ...env,
      RAZORPAY_WEBHOOK_SECRET: undefined,
    } as ApiEnv);

    await expect(service.handleWebhook(rawBody, webhookSignature(rawBody))).rejects.toMatchObject({
      status: 503,
      code: 'PAYMENT_NOT_CONFIGURED',
    });
  });

  it('never downgrades a paid order when a late failed event arrives', async () => {
    const rawBody = Buffer.from(JSON.stringify(webhookPayload('failed')));
    const { supabase, calls } = createSupabaseMock({
      payment_orders: [ok(paymentOrderRow({ status: 'paid' })), ok(null)],
      payments: [
        ok(null),
        ok({
          id: 'payment-1',
          payment_order_id: 'payment-order-1',
          provider_payment_id: providerPaymentId,
          status: 'captured',
          verified_at: '2026-10-07T10:05:00.000Z',
          created_at: '2026-10-07T10:05:00.000Z',
        }),
      ],
    });
    const service = new PaymentService(supabase, env);

    await service.handleWebhook(rawBody, webhookSignature(rawBody));

    expect(calls).toContainEqual({
      table: 'payment_orders',
      op: 'update',
      payload: { status: 'paid' },
    });
    expect(calls).toContainEqual({
      table: 'payments',
      op: 'insert',
      payload: expect.objectContaining({ status: 'captured' }),
    });
  });
});
