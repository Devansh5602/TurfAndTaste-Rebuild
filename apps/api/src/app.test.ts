import { WebSocket } from 'ws';
import { bookingDurationHoursSchema } from '@turf-and-taste/schemas';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { readEnv } from './config/env';
import { createSupabaseAdmin } from './db/supabase';
import { parseInput } from './utils/validate';

// Provide WebSocket polyfill for Supabase realtime client in Node.js 20
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const app = createApp(
  readEnv({
    NODE_ENV: 'test',
    WEB_ORIGIN: 'http://localhost:3000',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  }),
);

describe('api foundation', () => {
  it('returns the health envelope', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.error).toBeNull();
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('returns a stable error envelope for unknown routes', async () => {
    const response = await request(app).get('/api/v1/unknown-route');
    expect(response.status).toBe(404);
    expect(response.body.data).toBeNull();
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('requires authentication for booking routes', async () => {
    const response = await request(app).get('/api/v1/bookings');
    expect(response.status).toBe(401);
    expect(response.body.data).toBeNull();
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('requires authentication for payment order routes', async () => {
    const response = await request(app)
      .post('/api/v1/payments/orders')
      .send({ bookingId: '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66' });
    expect(response.status).toBe(401);
    expect(response.body.data).toBeNull();
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a Razorpay webhook that carries no provider signature', async () => {
    const response = await request(app)
      .post('/api/v1/payments/webhook/razorpay')
      .set('content-type', 'application/json')
      .send({ payload: {} });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MISSING_SIGNATURE');
  });

  it('keeps the Razorpay webhook outside customer authentication', async () => {
    // A signature header and raw body reach the service; the 503 proves no
    // 401 guard ran in front of it and that it fails closed when unconfigured.
    const response = await request(app)
      .post('/api/v1/payments/webhook/razorpay')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', 'a'.repeat(64))
      .send({ payload: {} });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('PAYMENT_NOT_CONFIGURED');
  });

  it('rejects invalid input without leaking schema details', () => {
    expect(() => parseInput(bookingDurationHoursSchema, 1.5)).toThrow('The request payload is invalid.');
  });

  it('refuses to create a Supabase admin client without server credentials', () => {
    expect(() =>
      createSupabaseAdmin(
        readEnv({
          NODE_ENV: 'test',
          WEB_ORIGIN: 'http://localhost:3000',
        }),
      ),
    ).toThrow('Supabase server credentials are not configured.');
  });
});
