import { healthResponseSchema } from '@turf-and-taste/schemas';
import type { ApiResponse, ApiSuccess, HealthData } from '@turf-and-taste/types';

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

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || body.error) {
    throw new ApiClientError(
      body.error?.message ?? 'The request failed.',
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
    );
  }

  return body.data;
}

export function publicRequest<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  return request<T>(baseUrl, path, init);
}

export function authenticatedRequest<T>(
  baseUrl: string,
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  return request<T>(baseUrl, path, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, ...init?.headers },
  });
}
