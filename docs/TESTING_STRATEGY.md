# Testing strategy

## Pyramid

| Layer | Tool | Phase 0 |
| --- | --- | --- |
| Unit | Vitest | tokens, product rules, API helpers, health client |
| Component (web) | React Testing Library | web button |
| Component (mobile) | jest-expo and React Native Testing Library | customer payment and booking screens |
| API | Vitest and Supertest | health and error envelope |
| Web E2E | Playwright | later, not installed |
| Mobile E2E | Maestro or Detox | later, after a device-lab check |

React Native Testing Library is the component runner for native UI; `apps/mobile` runs it under `jest-expo` with `pnpm --filter @turf-and-taste/mobile test`. Vitest remains the runner for the TypeScript packages and the API. Phase 0 native coverage was typecheck plus the shared token and rule tests. Maestro is the preferred first device runner because the flows are short and the app is Expo-based. Detox remains an option if a flow needs deeper native synchronization.

Razorpay checkout cannot run in these tests: `react-native-razorpay` is a native module. Checkout is mocked and the tests assert the screen behaviour around it. Verifying that the real checkout opens needs an Expo development build on a device.

## CI gates

On pull requests and pushes to `main`, `develop`, and work branches:

- `pnpm install --frozen-lockfile`
- lint
- typecheck
- unit and API tests
- web build
- API build
- mobile `tsc --noEmit`

CI does not deploy.

## Rules

- Add a test when a business rule or request contract changes.
- Do not snapshot large component trees in place of an assertion about behavior.
- Test data must not invent unauthorized sports or fake customers presented as production data.
