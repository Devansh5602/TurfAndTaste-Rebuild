import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../errors/http-error';
import { requireAuth, requireDomain, requirePermission, type AuthenticatedRequest } from './auth';

function makeRequest(user?: AuthenticatedRequest['user']): AuthenticatedRequest {
  return {
    user,
    supabase: undefined,
  } as unknown as AuthenticatedRequest;
}

const res = {} as Response;
const next = vi.fn();

beforeEach(() => {
  next.mockClear();
});

function captureError(run: () => void): HttpError {
  try {
    run();
  } catch (error) {
    if (error instanceof HttpError) return error;
    throw error;
  }
  throw new Error('Expected an HttpError to be thrown.');
}

describe('requireAuth', () => {
  it('rejects anonymous requests', () => {
    const error = captureError(() => requireAuth(makeRequest(), res, next));
    expect(error.status).toBe(401);
    expect(error.code).toBe('UNAUTHENTICATED');
    expect(next).not.toHaveBeenCalled();
  });

  it('passes with any authenticated domain', () => {
    const run = () => requireAuth(makeRequest({ id: 'u1', domain: 'customer' }), res, next);
    expect(run).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('requireDomain', () => {
  it('rejects a customer session for staff-only resources', () => {
    const error = captureError(() =>
      requireDomain('staff')(makeRequest({ id: 'u1', domain: 'customer' }), res, next),
    );
    expect(error.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests before any domain check', () => {
    const error = captureError(() => requireDomain('staff')(makeRequest(), res, next));
    expect(error.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a staff session on staff-only resources', () => {
    const run = () => requireDomain('staff')(makeRequest({ id: 'u1', domain: 'staff' }), res, next);
    expect(run).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('requirePermission', () => {
  it('rejects a customer session without consulting staff permissions', async () => {
    const req = makeRequest({ id: 'u1', domain: 'customer' });
    const rpc = vi.fn();
    req.supabase = { rpc } as unknown as AuthenticatedRequest['supabase'];

    await expect(requirePermission('bookings.create')(req, res, next)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    // A customer session must never reach the staff permission lookup.
    expect(rpc).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when no supabase client is attached', async () => {
    const req = makeRequest({ id: 'u1', domain: 'staff' });

    await expect(requirePermission('bookings.create')(req, res, next)).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('grants access only when the staff permission check passes', async () => {
    const allowed = makeRequest({ id: 'u1', domain: 'staff' });
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    allowed.supabase = { rpc } as unknown as AuthenticatedRequest['supabase'];

    await requirePermission('bookings.create')(allowed, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('staff_has_permission', {
      permission_key: 'bookings.create',
    });
  });

  it('denies staff without the permission', async () => {
    const denied = makeRequest({ id: 'u1', domain: 'staff' });
    denied.supabase = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    } as unknown as AuthenticatedRequest['supabase'];

    await expect(requirePermission('bookings.create')(denied, res, next)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
