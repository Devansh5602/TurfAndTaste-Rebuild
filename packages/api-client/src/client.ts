import { healthResponseSchema } from '@turf-and-taste/schemas';
import type { ApiSuccess, HealthData } from '@turf-and-taste/types';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export async function getHealth(
  baseUrl: string,
  init?: RequestInit,
): Promise<ApiSuccess<HealthData>> {
  const response = await fetch(new URL('/health', baseUrl), {
    ...init,
    headers: {
      accept: 'application/json',
      ...init?.headers,
    },
  });

  const body: unknown = await response.json();
  const parsed = healthResponseSchema.safeParse(body);
  if (!response.ok || !parsed.success) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
        ? body.error.message
        : 'The API health check failed.';
    const code =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'code' in body.error &&
      typeof body.error.code === 'string'
        ? body.error.code
        : 'HEALTH_CHECK_FAILED';
    throw new ApiClientError(message, response.status, code);
  }

  return parsed.data;
}
