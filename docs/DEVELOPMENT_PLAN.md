# Development plan

Each phase ends only when its exit criteria are true. Do not start a later phase's product UI during an earlier phase.

## Phase 0 — Foundation

Exit: monorepo installs, lint, typecheck, tests, web build, and API build pass. Mobile typecheck passes. Themes, tokens, docs, and CI exist. No product screens.

## Phase 1 — Database, auth, and API core

Exit: reviewed migrations are applied to the intended Supabase project, RLS is on, customer and staff auth are separated, and the API can identify a principal. No fake users in source.

## Phase 2 — Customer app navigation and authentication

Exit: the mobile customer shell can register, sign in, verify, recover, and sign out against the real auth project. Theme persistence still works.

## Phase 3 — Facilities and discovery

Exit: the four facilities and the shooting-machine add-on render from the database. Unauthorized sports are absent.

## Phase 4 — Booking engine

Exit: server quotes enforce schedule, duration, past-slot, and stale-quote rules. The client cannot set the price.

## Phase 5 — Payments and pass

Exit: Razorpay test-mode orders are verified on the server before a booking is confirmed. A pass or QR is produced from the confirmed booking.

## Phase 6 — Profile, bookings, and reviews

Exit: a customer sees only their profile, bookings, and reviews.

## Phase 7 — Events, dining, notices, and support

Exit: dining is readable CMS content. There is no cart, checkout, delivery, or food payment.

## Phase 8 — Admin authentication and dashboard

Exit: staff sign in through the staff principal. Customer credentials do not open the admin portal.

## Phase 9 — Admin booking, facilities, scheduling, and pricing

Exit: staff can manage facilities, add-ons, schedules, overrides, and prices. Changes are audited.

## Phase 10 — Admin customers, payments, reviews, and CMS

Exit: staff tools cover customers, payments, reviews, events, notices, and dining content, with permission checks.

## Phase 11 — Web customer experience

Exit: the web customer flows match the mobile rules, including both themes.

## Phase 12 — Web admin experience

Exit: the web admin portal uses the same API authorization as any future admin client.

## Phase 13 — E2E, security, performance, and accessibility

Exit: Playwright covers the critical web paths. A mobile device runner covers booking and auth. Dependency audit, contrast, and focus checks are recorded.

## Phase 14 — Staging

Exit: preview web, API, Supabase, and an internal Android build talk to staging data. Razorpay remains in test mode.

## Phase 15 — Production readiness

Exit: production checklist is signed off, including secrets, RLS review, payment verification, backups, and an explicit deploy authorization. Phase 0 does not deploy.
