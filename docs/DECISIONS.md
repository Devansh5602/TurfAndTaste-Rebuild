# Decisions

Lightweight architecture decision records. Do not reverse these casually.

## ADR 001 — pnpm workspaces and Turborepo

Status: accepted

The monorepo uses pnpm 12 workspaces and Turborepo. pnpm is pinned in `packageManager` and activated with Corepack in CI. Node.js 22 is pinned with `.nvmrc` and `.node-version`.

Alternatives: npm workspaces, Yarn, Nx. pnpm plus Turborepo is enough for three apps and shared packages without another orchestration layer.

## ADR 002 — TypeScript 5.9.3

Status: accepted

TypeScript 7.0.2 is published, and typescript-eslint 8.71 only accepts TypeScript `>=4.8.4 <6.1.0`. The repo pins 5.9.3, the newest 5.9 release inside that range. Revisit when the linter supports a newer TypeScript line.

## ADR 003 — Expo SDK 57 development builds

Status: accepted

The mobile app uses Expo SDK 57 with `expo-dev-client`, continuous native generation, and EAS profiles for APK and AAB. It does not use Expo Go.

Why not the React Native Community CLI: the app needs Android builds, Razorpay native checkout, push notifications, and deep links. Expo development builds support those native modules through config plugins and prebuild, while Metro, TypeScript, and monorepo tooling stay maintained by the Expo SDK. The Community CLI remains a valid fallback if a required native module cannot ship through a dev client. That blocker does not exist in Phase 0.

SDK 58 was still a beta on React Native 0.88 RC when this decision was made, so the stable SDK 57 line is the baseline.

## ADR 004 — NativeWind 4 and Tailwind 4

Status: accepted

Web uses Tailwind CSS 4. Mobile uses NativeWind 4.2.7, which depends on Tailwind CSS 3. NativeWind 5 was still a release candidate.

Both adapters read semantic tokens from `@turf-and-taste/design-tokens`. The two Tailwind majors are intentional and limited to the styling adapters. Do not add a third styling system.

## ADR 005 — Supabase is the system of record

Status: accepted

PostgreSQL, Auth, and Storage use the Supabase project created for this rebuild. Realtime is added only where it changes the product, not by default. Firebase is out of scope unless a later ADR records a technical requirement.

## ADR 006 — API contracts

Status: accepted

`apps/api/openapi/openapi.yaml` is the human-readable contract. Phase 0 has only `/health`, so client types are validated with Zod in `@turf-and-taste/schemas` instead of generating a client. Add `openapi-typescript` when the first business resource lands. Do not hand-duplicate a second model layer beside the schema package.

## ADR 007 — State

Status: accepted

Server state uses TanStack Query. Forms use React Hook Form and Zod. There is no Redux store. Add a small client store only when the same non-server state must be shared outside the component that owns it. Theme state is the current example, and it lives in the theme providers, not in a page.

## ADR 008 — Global themes

Status: accepted

Clubhouse Ivory and Midnight Ivory are the only themes. Web persists the choice with `next-themes` under `turf-and-taste-theme` on the document element. Mobile persists the same key with AsyncStorage and applies NativeWind CSS variables at the root. Auth tokens, when they exist, go in `expo-secure-store` or httpOnly cookies, not in the theme store.

## ADR 009 — Express 5

Status: accepted

The API is Express 5 on Node 22, bundled with tsup so workspace TypeScript packages can ship as one ESM artifact. Fastify and Hono were not selected because the required stack is Express.

## ADR 010 — UI primitives

Status: accepted

Web primitives sit on Radix, class-variance-authority, and Sonner, in the shadcn/ui style, without copying an application from the CLI. Mobile primitives use React Native, NativeWind, React Navigation, `@gorhom/bottom-sheet`, and `react-native-toast-message`. DOM components are not shared with React Native.

## ADR 011 — No remote schema in Phase 0

Status: accepted

`supabase/drafts/domain-model.sql` is a design draft. It is not a migration and must not be applied to the hosted database during Phase 0.

## ADR 012 — Server-authoritative payment verification

Status: accepted

The client identifies which pending booking it wants to pay for and sends back the raw Razorpay checkout result. It never sends a payable amount: `createPaymentOrderSchema` carries only `bookingId`, the API derives the amount from the booking's stored quote, and the server verifies the checkout signature, re-fetches the payment from Razorpay, and cross-checks the captured amount against the stored order before the booking becomes `confirmed`. A client success flag is never trusted.

The Razorpay webhook authenticates with an HMAC-SHA256 signature over the exact raw request body using `RAZORPAY_WEBHOOK_SECRET` (captured by `express.json`'s `verify` hook). The webhook route is mounted outside customer authentication because Razorpay calls it directly; every other payment route requires a customer session. Webhook and verify processing share one idempotent persistence path so provider retries and client retries are safe, a paid order is never downgraded, and booking confirmation failures surface to the caller instead of being swallowed.
