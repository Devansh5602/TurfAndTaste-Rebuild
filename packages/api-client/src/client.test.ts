import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, getHealth } from './client';

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
