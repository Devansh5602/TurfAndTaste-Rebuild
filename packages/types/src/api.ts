export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiMeta {
  requestId: string;
}

export interface ApiSuccess<T> {
  data: T;
  error: null;
  meta: ApiMeta;
}

export interface ApiFailure {
  data: null;
  error: ApiErrorBody;
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface HealthData {
  status: 'ok';
  service: 'turf-and-taste-api';
  timestamp: string;
}
