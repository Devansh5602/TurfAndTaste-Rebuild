import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadVercelApp() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('WEB_ORIGIN', 'https://preview.example.com');
  vi.stubEnv('SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', 'test-webhook-secret');
  vi.resetModules();

  return (await import('./index')).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Vercel Express entry', () => {
  it('exports the existing app without requiring a listening port', async () => {
    const app = await loadVercelApp();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('preserves exact webhook bytes for server-side signature verification', async () => {
    const app = await loadVercelApp();
    const rawBody = JSON.stringify({ payload: { payment: { entity: { id: 'pay_test' } } } });
    const signatureForDifferentBytes = createHmac('sha256', 'test-webhook-secret')
      .update(`${rawBody} `)
      .digest('hex');

    const response = await request(app)
      .post('/api/v1/payments/webhook/razorpay')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', signatureForDifferentBytes)
      .send(rawBody);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });
});
