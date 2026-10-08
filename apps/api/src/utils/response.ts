import type { ApiFailure, ApiSuccess } from '../../../../packages/types/src/index.js';

export function success<T>(data: T, requestId: string): ApiSuccess<T> {
  return { data, error: null, meta: { requestId } };
}

export function failure(code: string, message: string, requestId: string): ApiFailure {
  return { data: null, error: { code, message }, meta: { requestId } };
}
