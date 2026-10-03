import { z } from 'zod';

export const healthDataSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('turf-and-taste-api'),
  timestamp: z.iso.datetime(),
});

export const apiMetaSchema = z.object({
  requestId: z.string().min(1),
});

export const healthResponseSchema = z.object({
  data: healthDataSchema,
  error: z.null(),
  meta: apiMetaSchema,
});
