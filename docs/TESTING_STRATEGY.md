# Testing strategy

## Pyramid

| Layer | Tool | Phase 0 |
| --- | --- | --- |
| Unit | Vitest | tokens, product rules, API helpers, health client |
| Component | React Testing Library | web button |
| API | Vitest and Supertest | health and error envelope |
| Web E2E | Playwright | later, not installed |
| Mobile E2E | Maestro or Detox | later, after a device-lab check |

React Native Testing Library is the component runner for native UI once screens exist. Phase 0 native coverage is typecheck plus the shared token and rule tests. Maestro is the preferred first device runner because the flows are short and the app is Expo-based. Detox remains an option if a flow needs deeper native synchronization.

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
