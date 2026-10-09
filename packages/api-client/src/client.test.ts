import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, authenticatedRequest, getHealth, publicRequest } from './client';

describe('getHealth', () => {
  it('parses a successful health envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            data: {
              status: 'ok',
              service: 'turf-and-taste-api',
              timestamp: '2026-10-03T10:00:00.000Z',
            },
            error: null,
            meta: { requestId: 'req-1' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    const result = await getHealth('http://localhost:4000');
    expect(result.data.status).toBe('ok');
    expect(result.meta.requestId).toBe('req-1');
    vi.unstubAllGlobals();
  });

  it('rejects a malformed success body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ data: { status: 'up' } }), { status: 200 });
      }),
    );

    await expect(getHealth('http://localhost:4000')).rejects.toBeInstanceOf(ApiClientError);
    vi.unstubAllGlobals();
  });
});

describe('request authorization', () => {
  it('does not send an authorization header for public catalog requests', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ data: [], error: null }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await publicRequest('http://localhost:4000', '/api/v1/facilities');

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has('authorization')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('sends the bearer token for authenticated requests', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ data: [], error: null }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await authenticatedRequest('http://localhost:4000', '/api/v1/bookings', 'customer-token');

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
      'Bearer customer-token',
    );
    vi.unstubAllGlobals();
  });
});

describe('authenticatedRequest', () => {
  it('returns data from a successful API envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ data: [{ id: 'facility-1' }], error: null, meta: { requestId: 'req-2' } }),
      ),
    );

    await expect(
      authenticatedRequest<{ id: string }[]>(
        'http://localhost:4000',
        '/api/v1/facilities',
        'token',
      ),
    ).resolves.toEqual([{ id: 'facility-1' }]);
    vi.unstubAllGlobals();
  });

  it('throws the API envelope error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Sign in required.' },
            meta: { requestId: 'req-3' },
          },
          { status: 401 },
        ),
      ),
    );

    await expect(
      authenticatedRequest('http://localhost:4000', '/api/v1/facilities', 'token'),
    ).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED', message: 'Sign in required.' });
    vi.unstubAllGlobals();
  });
});
