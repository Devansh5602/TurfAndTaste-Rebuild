import { AUTH_DOMAINS, type AuthDomain } from '../../../../packages/types/src/index.js';

export function isAuthDomain(value: string): value is AuthDomain {
  return AUTH_DOMAINS.some((domain) => domain === value);
}
