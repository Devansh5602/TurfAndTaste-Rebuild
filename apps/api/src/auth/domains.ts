import { AUTH_DOMAINS, type AuthDomain } from '@turf-and-taste/types';

export function isAuthDomain(value: string): value is AuthDomain {
  return AUTH_DOMAINS.some((domain) => domain === value);
}
