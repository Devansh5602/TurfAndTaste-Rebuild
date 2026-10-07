# Architecture

Phase 0 is the foundation. Product screens, booking endpoints, and the production schema are later phases. See `docs/DEVELOPMENT_PLAN.md`.

## Monorepo

```text
apps/web        Next.js App Router, Tailwind CSS 4, Vercel target
apps/mobile     Expo SDK 57 dev client, NativeWind, Android first
apps/api        Express 5, tsup bundle, hosted Node or Vercel Functions target
packages/design-tokens
packages/types
packages/schemas
packages/api-client
packages/config
packages/ui-web
packages/ui-native
supabase/       CLI layout and unapplied domain draft
```

Web and mobile do not share DOM components. They share tokens, types, Zod schemas, and the API client.

## Request flow

```text
Web or Mobile
  -> @turf-and-taste/api-client
    -> Express /health and, later, /api/v1/*
      -> Zod validation
      -> services
      -> Supabase (service role only on the server)
```

The Phase 0 route is `GET /health`. `/api/v1` is mounted and currently falls through to the error envelope.

Responses use one envelope:

```json
{ "data": {}, "error": null, "meta": { "requestId": "" } }
```

Failures use `data: null` and an `error` object with `code` and `message`. Internal details stay in logs.

## Web

- App Router under `apps/web/src/app`.
- Root layout owns the font, theme attribute, TanStack Query client, and toaster.
- `next-themes` persists Clubhouse Ivory or Midnight Ivory across routes and reloads.
- Route `loading.tsx` and `error.tsx` are the loading and error boundaries.

## Mobile

- React Navigation native stack. Expo Router is not used, so there is one navigation system.
- `ThemeProvider` in `@turf-and-taste/ui-native` applies NativeWind variables and persists the same storage key as web.
- `SafeAreaProvider`, gesture-handler root, and keyboard-aware scrolling are part of the shell.
- Deep link scheme: `turfandtaste://`.
- Future secrets use `expo-secure-store`. Theme preference uses AsyncStorage.
- Android package and iOS bundle id: `in.turfandtaste.app`.
- Native projects are generated with `expo prebuild`. `android/` and `ios/` are gitignored.
- EAS profiles in `apps/mobile/eas.json` describe development APK, preview APK, and production AAB. Phase 0 does not run EAS.

## API

```text
apps/api/src
  config/       environment parsing
  middleware/   request id, 404, errors
  routes/       health and /api/v1 mount
  modules/      feature modules, empty in Phase 0
  services/     use-case layer, empty in Phase 0
  db/           server-only Supabase client factory
  auth/         customer and staff domain names
  errors/
  utils/
  app.ts
  server.ts
```

Helmet, CORS, JSON limits, request ids, pino, and rate limits are installed. Rate limiting and request logs are off when `NODE_ENV=test`. Health checks are excluded from the rate limit. CORS allows the configured web origin and requests with no browser origin, which covers the native app.

## Authentication plan

Customers and staff are different principals.

- Customers: Supabase Auth, profile row, customer RLS.
- Staff: separate staff profile, roles, and permissions. Admin routes require a staff principal. Customer JWT claims must not satisfy staff policies.
- The API verifies the caller. The UI hiding a link is not authorization.
- Phase 0 does not create users or accept passwords.

## Booking plan

```text
Facility -> date -> slot -> duration -> customer details
  -> server quote -> review -> booking intent
  -> payment order -> Razorpay checkout
  -> server verification -> confirmed booking -> pass / QR
```

Rules already encoded for later use:

- Facility keys are the authorized sports only.
- Shooting machine is allowed only with Cricket Green Net Practice.
- Durations are 1 or 2 hours.
- A slot that starts before the server clock is in the past.
- Changing facility, date, start, duration, or add-on makes a quote stale.
- Business calendar dates use `Asia/Kolkata`.

The server owns price, surcharges, quote expiry, and confirmation. The client displays the server quote.

## Payment plan

```text
Client -> Express -> Razorpay order
Client -> Razorpay checkout
Razorpay result -> Express signature verification
  -> payment row -> booking confirmed
```

A client success flag is not confirmation. Razorpay secrets stay in the API environment. Development uses test keys only. Phase 0 does not create orders.

## Data ownership

| Data | Owner |
| --- | --- |
| Domain ids, labels, durations | `packages/types` |
| Validation and booking rules | `packages/schemas` |
| Visual values | `packages/design-tokens` |
| HTTP calls | `packages/api-client` |
| Rows, RLS, files | Supabase, accessed by the API for privileged work |
| Public Supabase URL and anon key | Web and mobile, for Auth flows that Supabase expects on the client |

Service-role keys never enter web or mobile.

## Deployment topology

| Surface | Target | Phase 0 |
| --- | --- | --- |
| Web | Vercel | not deployed |
| API | hosted Node process or separate Vercel Express project | not deployed |
| Database | existing Supabase project | not migrated |
| Mobile | Android APK/AAB via EAS | not built |

## Environment boundaries

Public `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` values are browser or app visible. Everything else is server-only. Details are in `docs/ENVIRONMENTS.md`.
