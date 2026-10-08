import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/http-error.js';
import { createSupabaseAdmin, createSupabaseClient } from '../db/supabase.js';
import type { ApiEnv } from '../config/env.js';
import type { AuthDomain } from '@turf-and-taste/types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    domain: AuthDomain;
    email?: string;
    phone?: string;
  };
  supabase?: ReturnType<typeof createSupabaseClient>;
  // Populated by express.json's verify hook for signature checks over raw bytes.
  rawBody?: Buffer;
}

export function createAuthMiddleware(env: ApiEnv) {
  return async function authMiddleware(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const authHeader = req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.slice(7);
    const supabase = createSupabaseClient(env, token);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      next();
      return;
    }

    // Check if user is staff
    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('id, auth_user_id, full_name, active')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .maybeSingle();

    if (staffProfile) {
      req.user = {
        id: staffProfile.id,
        domain: 'staff',
        email: user.email,
        phone: user.phone,
      };
      req.supabase = supabase;
      next();
      return;
    }

    // Check if user is customer
    const { data: customerProfile } = await supabase
      .from('customer_profiles')
      .select('id, full_name, phone, email')
      .eq('id', user.id)
      .maybeSingle();

    if (customerProfile) {
      req.user = {
        id: customerProfile.id,
        domain: 'customer',
        email: customerProfile.email ?? user.email,
        phone: customerProfile.phone ?? user.phone,
      };
      req.supabase = supabase;
      next();
      return;
    }

    // Repair a missing profile for pre-trigger customer accounts without trusting a client id.
    const fullName =
      typeof user.user_metadata.full_name === 'string' && user.user_metadata.full_name.trim()
        ? user.user_metadata.full_name.trim()
        : 'Customer';
    const admin = createSupabaseAdmin(env);
    const { data: provisionedProfile, error: provisioningError } = await admin
      .from('customer_profiles')
      .insert({ id: user.id, full_name: fullName, email: user.email, phone: user.phone })
      .select('id, email, phone')
      .single();
    if (!provisioningError && provisionedProfile) {
      req.user = {
        id: provisionedProfile.id,
        domain: 'customer',
        email: provisionedProfile.email ?? user.email,
        phone: provisionedProfile.phone ?? user.phone,
      };
      req.supabase = supabase;
    }
    next();
  };
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }
  next();
}

export function requireDomain(...domains: AuthDomain[]) {
  return function domainMiddleware(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): void {
    if (!req.user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }
    if (!domains.includes(req.user.domain)) {
      throw new HttpError(403, 'FORBIDDEN', 'Insufficient permissions for this resource.');
    }
    next();
  };
}

export function requirePermission(permissionKey: string) {
  return async function permissionMiddleware(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.user || req.user.domain !== 'staff') {
      throw new HttpError(403, 'FORBIDDEN', 'Staff authentication required.');
    }
    if (!req.supabase) {
      throw new HttpError(500, 'INTERNAL_ERROR', 'Supabase client not available.');
    }

    const { data, error } = await req.supabase.rpc('staff_has_permission', {
      permission_key: permissionKey,
    });

    if (error || !data) {
      throw new HttpError(403, 'FORBIDDEN', 'Insufficient permissions.');
    }

    next();
  };
}
