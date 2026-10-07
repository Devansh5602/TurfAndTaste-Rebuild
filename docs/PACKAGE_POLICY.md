# Package policy

Before adding a dependency, check that a maintained package does not already cover it, that it fits this stack, that TypeScript types exist, that the license is usable, and that it does not duplicate a package already chosen.

One library per job. Date handling is date-fns and date-fns-tz. HTTP from the apps is `fetch` through `@turf-and-taste/api-client`. Server state is TanStack Query. Forms are React Hook Form plus Zod. There is no Redux.

## Chosen packages

| Package | Job | Where | Why | Not chosen |
| --- | --- | --- | --- | --- |
| pnpm 10.34.6 | Install and workspaces | repo | Newest Vercel-supported pnpm 10 release, pinned for Corepack | npm, Yarn |
| Turborepo 2 | Task graph | repo | Small monorepo task runner | Nx |
| TypeScript 5.9.3 | Types | all | Newest line the ESLint parser accepts | TypeScript 7, blocked by typescript-eslint |
| Next.js 16.3.8 | Web | web | Required stack, current security patch | — |
| Tailwind CSS 4 | Web styling | web | Current Tailwind for Next | — |
| NativeWind 4.2.7 | Native styling | mobile | Stable NativeWind for Expo 57 | NativeWind 5 RC |
| Tailwind CSS 3 | NativeWind peer | mobile | Required by NativeWind 4 | sharing Tailwind 4 with NativeWind 4 |
| Expo SDK 57 | Native runtime | mobile | Dev client, prebuild, EAS | Expo Go, SDK 58 beta, RN Community CLI |
| React Navigation 7 | Navigation | mobile | Required navigation library | Expo Router |
| Express 5 | HTTP server | api | Required stack | Fastify, Hono |
| Zod 4 | Validation | schemas, api | Shared client and server schemas | Yup, Valibot |
| TanStack Query 5 | Server state | web, mobile | Cache and request status | SWR, Redux |
| React Hook Form | Forms | web, mobile | Standard form state | Formik |
| @hookform/resolvers | Zod adapter | web, mobile | Connects the form library to Zod | hand-rolled resolver |
| date-fns / date-fns-tz | Dates | schemas | Time zones without a second date library | Moment, Day.js |
| Radix UI | Web behavior | ui-web | Dialog, checkbox, radio, slot | custom focus traps |
| class-variance-authority, clsx, tailwind-merge | Variants | ui-web | shadcn-style variants | twin.macro |
| Sonner | Web toast | ui-web | Maintained toast used with shadcn | react-hot-toast |
| lucide-react | Web icons | ui-web | Maintained icon set | Font Awesome kit |
| next-themes | Web theme persistence | web | Attribute, storage, no flash script | page-local state |
| @gorhom/bottom-sheet | Mobile sheet | ui-native | Standard sheet on Reanimated | custom gesture sheet |
| react-native-toast-message | Mobile toast | ui-native | Maintained native toast | a second Sonner port |
| React Native Safe Area, Screens, Gesture Handler, Reanimated | Native shell | mobile | Required by navigation and sheets | custom implementations |
| AsyncStorage | Non-secret persistence | mobile | Theme preference | SecureStore for theme |
| expo-secure-store | Future secrets | mobile | Keychain / keystore | AsyncStorage for tokens |
| expo-splash-screen | Native splash | mobile | SDK 57's supported way to set the splash image and colour | the root `splash` key, removed from the SDK 57 config schema |
| @expo-google-fonts/plus-jakarta-sans | Mobile font | mobile | Same face as web | bundled custom font files |
| Helmet | Headers | api | Standard Express headers | hand-rolled header list |
| cors | CORS | api | Explicit origin callback | wildcard reflection |
| pino / pino-http | Logs | api | Structured logs | console.log |
| express-rate-limit | Rate limit | api | In-process limit for Phase 0 | a custom counter |
| @supabase/supabase-js | Data and auth SDK | api | Official server SDK | Firebase |
| Vitest | Unit tests | packages, api | One runner for TS packages | Jest outside React Native |
| Testing Library React | Web components | ui-web | DOM queries by role | enzyme |
| jest-expo 57 | Mobile component tests | mobile | Expo's supported React Native test preset | Vitest for React Native |
| React Native Testing Library | Mobile component queries | mobile | Queries by text and accessibility label | snapshot-only assertions |
| Supertest | HTTP tests | api | Exercises the Express app | mocking listen() |
| tsup | API bundle | api | Bundles workspace TS for Node | running raw .ts in production |
| razorpay | Payment provider SDK | api | Server-side order creation and payment fetch | hand-rolled REST calls |
| react-native-razorpay (+ @types) | Mobile checkout | mobile | Maintained native Razorpay checkout for the dev client | a webview payment flow |

Licenses for these packages are permissive (MIT, Apache-2.0, or ISC) at the versions installed. Re-check the license if a major upgrade changes it.

Native module versions are aligned with Expo SDK 57. Change them with `expo install`, not by guessing a React Native version.

`npx expo-doctor` passes 21/21 and `npx expo install --check` reports no SDK-recommended native version left behind after the native-readiness checkpoint on 2026-10-07. That checkpoint realigned, in one change: `expo` to `57.0.27`, `expo-dev-client`, `expo-font`, `expo-linking`, `expo-secure-store`, `expo-status-bar`, `react-native` to `0.86.3`, `react-native-gesture-handler` to `~2.32.0`, `react-native-reanimated` to `4.5.1`, `react-native-worklets` to `0.10.1`, `react-native-screens` to `~4.26.0`, `react-native-safe-area-context` to `~5.7.0`, `react-native-svg` to `15.15.4`, plus `expo-splash-screen`. Re-check the drift with `npx expo install --check` whenever `expo` itself moves.

One deliberate deviation remains: Expo recommends `typescript@~6.0.3` for SDK 57, but TypeScript 6.0.3 drops the `@types/jest` globals `apps/mobile` needs and `pnpm --filter @turf-and-taste/mobile typecheck` fails on it. The repo stays on TypeScript 5.9.3 from the catalog and `apps/mobile/package.json` declares `expo.install.exclude: ["typescript"]` so the deviation is explicit instead of reappearing as an unexplained doctor failure. TypeScript does not participate in Metro, prebuild, or Gradle.

`nodeLinker: hoisted` lives in `pnpm-workspace.yaml` and is also mirrored by `node-linker=hoisted` in `.npmrc`, so pnpm 10 preserves the workspace-root layout required by Metro. Catalogs, `workspace:*`, `minimumReleaseAgeExclude`, and the Expo release-age exclusions remain supported and unchanged. After changing pnpm versions, if a workspace script fails with a stale `node_modules/.pnpm/...` path in `node_modules/.bin`, run `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`.

`apps/mobile` must not take `@react-native/jest-preset` as a direct dependency. See ADR 013.

The Razorpay SDKs were added in the payments phase. They run inside the API and the Expo development build; key secret and webhook secret remain server-only.
