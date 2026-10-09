-- DESIGN DRAFT ONLY.
-- Do not move this file into supabase/migrations during Phase 0.
-- Do not apply it to the hosted Turf & Taste Rebuild database without review.

-- Business calendar dates are interpreted in Asia/Kolkata.
-- Instants are stored as timestamptz.

create table public.customer_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  full_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.staff_role_assignments (
  staff_profile_id uuid not null references public.staff_profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (staff_profile_id, role_id)
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('box-cricket', 'skating-rink', 'pickle-ball', 'cricket-green-net')),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.facility_addons (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  key text not null check (key in ('shooting-machine')),
  name text not null,
  active boolean not null default true,
  unique (facility_id, key)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  closed boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  addon_id uuid references public.facility_addons (id),
  duration_hours smallint not null check (duration_hours >= 1),
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR',
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles (id),
  status text not null,
  starts_at timestamptz not null,
  duration_hours smallint not null check (duration_hours >= 1),
  quoted_amount_paise integer not null check (quoted_amount_paise >= 0),
  currency text not null default 'INR',
  quote_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  facility_id uuid not null references public.facilities (id),
  addon_id uuid references public.facility_addons (id),
  amount_paise integer not null check (amount_paise >= 0)
);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  provider text not null default 'razorpay',
  provider_order_id text not null unique,
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR',
  status text not null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders (id),
  provider_payment_id text not null unique,
  status text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  customer_profile_id uuid not null references public.customer_profiles (id),
  rating smallint not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  starts_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dining_outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dining_categories (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.dining_outlets (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.dining_categories (id) on delete cascade,
  name text not null,
  description text,
  price_paise integer check (price_paise is null or price_paise >= 0),
  available boolean not null default true,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid references public.customer_profiles (id),
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid references public.staff_profiles (id),
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index bookings_customer_starts_idx on public.bookings (customer_profile_id, starts_at);
create index schedules_facility_weekday_idx on public.schedules (facility_id, weekday);
create index menu_items_category_idx on public.menu_items (category_id);

-- RLS policies are part of the Phase 1 migration, not this draft.
-- Every public table above must enable row level security before exposure.
-- Customer policies must not grant staff permissions.
-- Dining tables are read models for customers and write models for staff. They are not orders.
