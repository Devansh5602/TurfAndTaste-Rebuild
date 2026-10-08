# Decisions

Lightweight architecture decision records. Do not reverse these casually.

## ADR 001 — pnpm workspaces and Turborepo

Status: accepted

The monorepo uses pnpm 10 workspaces and Turborepo. pnpm is pinned in `packageManager` and activated with Corepack in CI. Node.js 22 is pinned with `.nvmrc` and `.node-version`.

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

## ADR 013 — Mobile component test runner

Status: accepted

Native screens are covered by component tests that run `jest-expo` (Android preset) with React Native Testing Library. Vitest stays the runner for the TypeScript packages and the API; Jest is only used inside `apps/mobile`, where React Native and `babel-preset-expo` have to execute.

React Native must resolve to one installed instance across the workspace. NativeWind's `className` types arrive through `react-native-css-interop`'s `declare module "react-native"` augmentation, and TypeScript will not apply an augmentation to a second copy of `react-native`. `@react-native/jest-preset` is therefore not a direct dependency of `apps/mobile`: `jest-expo` still gets it as an installed peer and falls back to `react-native/jest-preset` when it is absent. Adding it as a direct dependency split `react-native` into two store instances and broke `packages/ui-native` typechecking.

Native-only modules the screens never render, such as `@gorhom/bottom-sheet`, are mapped to a test stub rather than loading the gesture-handler native path. Test query clients use `gcTime: 0` and `staleTime: 0` so TanStack Query's cache timers do not hold the Jest process open.

## ADR 014 — Hoisted install and Expo SDK 57 alignment

Status: accepted

The repo declared `node-linker=hoisted` in `.npmrc`, but pnpm 12.8.1 reads project settings from `pnpm-workspace.yaml`, so the install had been isolated all along. Under the isolated layout Metro's `nodeModulesPaths` could not reach `node_modules/.pnpm/node_modules`, and `expo export` failed to resolve `hoist-non-react-statics` from `react-native-gesture-handler`. The setting now lives in `pnpm-workspace.yaml` as `nodeLinker: hoisted`, which is the layout Expo recommends for pnpm and the layout `apps/mobile/metro.config.js` already assumed. `.npmrc` is retained for older pnpm but is inert at 12.8.1. Changing the linker restructures every `node_modules` in the repo; it does not change `pnpm-lock.yaml`.

The same checkpoint realigned the mobile app to the installed Expo SDK 57 with `expo install --fix` rather than by editing versions by hand, so the package now matches `expo/bundledNativeModules.json`. Two side effects were kept deliberately: `expo-splash-screen` replaced the root `splash` key, which the SDK 57 config schema rejects and which prebuild was silently ignoring (the generated splash used Expo's default artwork on white instead of the app's ivory), and the removed `newArchEnabled` key was dropped because SDK 57 has no such option. `expo-install` release-age exclusions were added to `minimumReleaseAgeExclude` because the freshly published Expo packages fail the repo's supply-chain policy without them.

TypeScript was **not** moved to the Expo-recommended `~6.0.3`. It broke `@types/jest` globals and failed `apps/mobile` typechecking, it has no bearing on Metro, prebuild, or Gradle, and 5.9.3 is the version the ESLint parser was chosen for. `expo.install.exclude` records the deviation. Revisit only alongside a deliberate TypeScript upgrade for the whole workspace.

## ADR 015 — Separate Vercel Express Preview project

Status: accepted

The API may run as a separate Vercel Express project for Preview/staging and Android testing while retaining the conventional hosted Node entry. `apps/api/src/index.ts` is the serverless boundary: it default-exports the existing `createApp(readEnv())` application without calling `listen`. `apps/api/src/server.ts` remains the local and long-running Node entry and calls the same factory before opening `env.PORT`. This changes deployment topology without duplicating middleware, routes, Supabase access, payment verification, or webhook handling.

Current Vercel Express support recognizes `src/index.ts` and routes the exported application without custom configuration, so no `vercel.json` is added. Legacy `builds` and `routes` configuration is explicitly avoided. The API project uses `apps/api` as its Root Directory and stays separate from the web and all Track A projects. Initial credentials are Preview/test-only; deployment and production promotion require separate authorization.

The root and API Node engine range is `^22.13.0`. This preserves the repository's minimum while constraining Vercel to Node 22; the previous `>=22.13.0` could resolve to a later supported major.

## ADR 016 — Vercel-supported pnpm 10 runtime

Status: accepted

The repository pins pnpm 10.34.6, the newest stable pnpm 10 release available when this decision was recorded. Vercel's current package-manager reference supports pnpm through major 10 and explicitly accepts lockfile format 9.0 with pnpm 10. With `ENABLE_EXPERIMENTAL_COREPACK=1`, Vercel reads the exact root `packageManager` pin instead of selecting from the lockfile alone.

The compatibility change does not alter the workspace structure or application dependencies. pnpm 10 consumes the existing version-9 lockfile; the only lockfile normalization removes pnpm 12's embedded package-manager wrapper preamble. Catalogs, `workspace:*` links, the hoisted node linker, `minimumReleaseAgeExclude`, Expo alignment, and security exclusions remain intact.

## ADR 017 — Provider-owned e-mail confirmation deep links

Status: accepted

The e-mail confirmation callback (`turfandtaste://auth/callback`) is handled by the auth provider through Expo Linking, not by React Navigation's `linking` prop. `AuthProvider` subscribes to `Linking.getInitialURL()`/`Linking.addEventListener('url')`, parses the URL in `src/auth/authCallback.ts`, and either calls `supabase.auth.setSession`/`exchangeCodeForSession` or enters a branded recoverable state. React Navigation's root guard (`RootNavigator`) renders that state; no second router was introduced.

The deciding constraint is token hygiene: GoTrue's implicit-flow redirect carries `#access_token`/`#refresh_token` in the URL. Passing such URLs through React Navigation's linking would place tokens into navigation state, where they surface in navigation state dumps and devtools. The provider path keeps tokens inside the auth layer, where only code/name diagnostics are ever logged.

The redirect target is a single constant (`MOBILE_AUTH_CALLBACK_URL`) shared by sign-up, resend, and the parser, so the Supabase dashboard Redirect URL allowlist has exactly one deep-link entry to match. The Expo `scheme` (`turfandtaste`) predates the Android dev client build, so the callback is JS-only: no new intent filters, no native rebuild.
