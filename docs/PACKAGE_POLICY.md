# Package policy

Before adding a dependency, check that a maintained package does not already cover it, that it fits this stack, that TypeScript types exist, that the license is usable, and that it does not duplicate a package already chosen.

One library per job. Date handling is date-fns and date-fns-tz. HTTP from the apps is `fetch` through `@turf-and-taste/api-client`. Server state is TanStack Query. Forms are React Hook Form plus Zod. There is no Redux.

## Chosen packages

| Package | Job | Where | Why | Not chosen |
| --- | --- | --- | --- | --- |
| pnpm 12.8.1 | Install and workspaces | repo | Current pnpm line, pinned for Corepack | npm, Yarn |
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
| @expo-google-fonts/plus-jakarta-sans | Mobile font | mobile | Same face as web | bundled custom font files |
| Helmet | Headers | api | Standard Express headers | hand-rolled header list |
| cors | CORS | api | Explicit origin callback | wildcard reflection |
| pino / pino-http | Logs | api | Structured logs | console.log |
| express-rate-limit | Rate limit | api | In-process limit for Phase 0 | a custom counter |
| @supabase/supabase-js | Data and auth SDK | api | Official server SDK | Firebase |
| Vitest | Unit tests | packages, api | One runner for TS packages | Jest for unit tests |
| Testing Library React | Web components | ui-web | DOM queries by role | enzyme |
| Supertest | HTTP tests | api | Exercises the Express app | mocking listen() |
| tsup | API bundle | api | Bundles workspace TS for Node | running raw .ts in production |
| razorpay | Payment provider SDK | api | Server-side order creation and payment fetch | hand-rolled REST calls |
| react-native-razorpay (+ @types) | Mobile checkout | mobile | Maintained native Razorpay checkout for the dev client | a webview payment flow |

Licenses for these packages are permissive (MIT, Apache-2.0, or ISC) at the versions installed. Re-check the license if a major upgrade changes it.

Native module versions are aligned with Expo SDK 57. Change them with `expo install`, not by guessing a React Native version.

The Razorpay SDKs were added in the payments phase. They run inside the API and the Expo development build; key secret and webhook secret remain server-only.
