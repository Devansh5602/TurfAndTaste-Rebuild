# Security

## Secrets

- Real secrets are environment variables, not source files.
- `.env` is gitignored. Only `*.env.example` files are committed, and they contain empty or local placeholders.
- Logs must not include passwords, tokens, service-role keys, or Razorpay secrets.
- Client bundles may contain only public configuration.

## Auth boundaries

Customer and staff are separate domains. A customer session cannot call staff operations. Phase 1 enforces this in Supabase RLS and in API guards. Hidden navigation is not a control.

## RBAC

Staff permissions are data: roles, permissions, and assignments. Checks happen in the API and in database policies. The admin UI mirrors those checks so people are not offered actions they cannot perform.

## Supabase RLS

Every application table enables RLS before it is exposed. The service role is used by the API for operations that cannot be expressed as the end user's policies, especially payment verification. Web and mobile use the anon key only.

## HTTP

The API sets security headers with Helmet, disables `x-powered-by`, limits JSON bodies to 1 MB, and rate-limits non-health traffic. CORS allows the configured web origin and non-browser clients.

## Validation

Zod parses inputs on the server. Error responses do not echo schema dumps. There is no silent `catch` that drops a failure without a response or a fallback.

## Payments

Razorpay orders are created by the API. The amount is the server quote. The client checkout result is unverified until the API checks the Razorpay signature and writes the payment row. Test mode only until a later phase says otherwise.

## Booking integrity

Clients do not send the payable total as the source of truth. Quotes expire and are invalidated when facility, date, slot, duration, or add-on changes. Past slots are rejected using server time.

## PII

Customer name, phone, and email are profile data. Do not put them in design docs, fixtures, or logs. Phase 0 has no customer records.

## Sessions

Web auth, when added, should use Supabase's recommended browser storage for that product version and httpOnly cookies where the server owns the session. Mobile auth tokens go in `expo-secure-store`. AsyncStorage is for the theme preference and other non-secret preferences.

## Dependencies

CI installs with a frozen lockfile. Dependency audits are part of the production-readiness phase. Do not add a second library for the same job. See `docs/PACKAGE_POLICY.md`.

## Logging

API logs go through pino. `console.log` is an ESLint error.
