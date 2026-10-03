import type { ZodType } from 'zod';
import { HttpError } from '../errors/http-error';

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'The request payload is invalid.');
  }
  return parsed.data;
}
