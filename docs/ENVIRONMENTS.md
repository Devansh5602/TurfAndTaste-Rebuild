# Environments

Never commit real keys. Templates:

- `.env.example`
- `apps/web/.env.example`
- `apps/mobile/.env.example`
- `apps/api/.env.example`

## Classes

| Class | Prefix | Where it may live |
| --- | --- | --- |
| Public client | `NEXT_PUBLIC_`, `EXPO_PUBLIC_` | Web bundle, mobile bundle |
| Server secret | none of the public prefixes | API process only |

Public values can include the API base URL, the Supabase project URL, and the Supabase anon or publishable key.

Server-only values include `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, and any future webhook secret.

## Local

Copy each example to `.env` in that package. The API loads `.env` with Node's `--env-file-if-exists`. Web uses Next's env loading. Mobile uses Expo's `EXPO_PUBLIC_` loading.

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## Development, preview, production

| Name | Web | API | Mobile | Data |
| --- | --- | --- | --- | --- |
| local | `next dev` | `tsx watch` | Expo dev client | not migrated in Phase 0 |
| development | Vercel development env, later | hosted dev process, later | internal dev client | Supabase dev |
| preview / staging | Vercel preview | matching API preview | preview APK | Supabase preview or staging |
| production | Vercel production | production Node process | Play AAB | production Supabase |

Phase 0 does not create these hosted environments.

## Razorpay

Development and preview use test mode keys. The key id may reach the client at checkout time because Razorpay's checkout requires it. The key secret and webhook secret stay on the server. Production live keys are out of scope until a later phase explicitly enables them.

## Supabase

The anon key is constrained by Row Level Security. The service role bypasses RLS and stays in the API environment. Do not put the service role in `NEXT_PUBLIC_` or `EXPO_PUBLIC_` variables.
