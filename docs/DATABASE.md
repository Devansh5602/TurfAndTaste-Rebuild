# Database

Supabase is the system of record for this rebuild. Phase 0 does not apply SQL to the hosted project.

## Layout

```text
supabase/migrations/   empty until Phase 1
supabase/seed/         empty until fixture data is explicitly approved
supabase/drafts/       design only, not executed
supabase/config/       notes for the later CLI link
```

`supabase/drafts/domain-model.sql` is a draft. Do not copy it into `migrations/` and push it without a Phase 1 review.

## Conventions for the first migration

- UUID primary keys
- `timestamptz` for instants, interpreted in `Asia/Kolkata` for business dates
- `created_at` and `updated_at`
- Foreign keys and indexes for lookup paths
- Soft delete only where history must remain visible after a hide action
- Row Level Security enabled on every exposed table
- Service-role access only from the API process
- Audit log for staff mutations and payment state changes
- Check constraints for facility keys, add-ons, and booking durations

## Domain model

The draft covers:

- customer profiles
- staff profiles
- roles, permissions, and assignments
- facilities and add-ons
- schedules and overrides
- pricing tiers
- bookings and booking items
- payment orders and payments
- reviews
- events and notices
- dining outlets, categories, and menu items
- inquiries
- audit logs

There is no food-order, cart, or delivery table.

Facilities are limited to box cricket, skating rink, pickle ball, and cricket green net. The shooting machine is an add-on row that can attach only to cricket green net.

Customer profiles and staff profiles are separate. Policies must not treat a customer `auth.uid()` as staff.

## Phase 1

Link the existing Supabase project, confirm the Postgres version, and replace the draft with reviewed migrations. Do not import data from any older Turf & Taste database.
