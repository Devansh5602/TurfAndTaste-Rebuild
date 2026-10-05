import { Router } from 'express';
import { z } from 'zod';
import { parseInput } from '../utils/validate';
import { currentRequestId } from '../middleware/request-id';
import { success } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createProfileRoutes(supabase: SupabaseClient) {
  const router = Router();

  // Get current customer profile
  router.get('/me', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        return res.status(401).json(success(null, currentRequestId(res)));
      }

      const { data, error } = await supabase
        .from('customer_profiles')
        .select('id, full_name, phone, email, created_at, updated_at')
        .eq('id', req.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return res.status(404).json(success(null, currentRequestId(res)));
      }

      res.json(success(data, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  // Update customer profile
  const updateProfileSchema = z.object({
    full_name: z.string().min(1).max(100).optional(),
    phone: z.string().max(20).optional(),
    email: z.string().email().optional(),
  });

  router.patch('/me', async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user || req.user.domain !== 'customer') {
        return res.status(401).json(success(null, currentRequestId(res)));
      }

      const input = parseInput(updateProfileSchema, req.body);

      const { data, error } = await supabase
        .from('customer_profiles')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.user.id)
        .select('id, full_name, phone, email, created_at, updated_at')
        .single();

      if (error) throw error;

      res.json(success(data, currentRequestId(res)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}