-- Migration: Initial schema for Turf & Taste
-- Created: 2025-01-01
-- Description: Core domain tables for profiles, staff, roles, facilities, schedules, pricing, bookings, payments, and related domains

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================

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

-- ============================================================
-- RBAC
-- ============================================================

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

-- ============================================================
-- FACILITIES & ADD-ONS
-- ============================================================

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

-- ============================================================
-- SCHEDULES & OVERRIDES
-- ============================================================

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

-- ============================================================
-- PRICING
-- ============================================================

create table public.pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  addon_id uuid references public.facility_addons (id),
  duration_hours smallint not null check (duration_hours in (1, 2)),
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR',
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- BOOKINGS
-- ============================================================

create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles (id),
  status public.booking_status not null default 'pending',
  starts_at timestamptz not null,
  duration_hours smallint not null check (duration_hours in (1, 2)),
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

-- ============================================================
-- PAYMENTS
-- ============================================================

create type public.payment_order_status as enum ('created', 'paid', 'failed', 'expired', 'refunded');
create type public.payment_status as enum ('captured', 'failed', 'refunded');

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  provider text not null default 'razorpay',
  provider_order_id text not null unique,
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR',
  status public.payment_order_status not null default 'created',
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders (id),
  provider_payment_id text not null unique,
  status public.payment_status not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REVIEWS
-- ============================================================

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  customer_profile_id uuid not null references public.customer_profiles (id),
  rating smallint not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- EVENTS & NOTICES
-- ============================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  body text,
  starts_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  body text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- DINING
-- ============================================================

create table public.dining_outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dining_categories (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.dining_outlets (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  unique (outlet_id, name)
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
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

-- ============================================================
-- INQUIRIES
-- ============================================================

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid references public.customer_profiles (id),
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid references public.staff_profiles (id),
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index bookings_customer_starts_idx on public.bookings (customer_profile_id, starts_at);
create index bookings_status_starts_idx on public.bookings (status, starts_at);
create index bookings_facility_starts_idx on public.bookings (starts_at); -- facility via booking_items join
create index schedules_facility_weekday_idx on public.schedules (facility_id, weekday);
create index schedule_overrides_facility_range_idx on public.schedule_overrides (facility_id, starts_at, ends_at);
create index pricing_tiers_facility_addon_duration_idx on public.pricing_tiers (facility_id, addon_id, duration_hours, effective_from);
create index menu_items_category_idx on public.menu_items (category_id);
create index audit_logs_actor_created_idx on public.audit_logs (actor_staff_id, created_at);
create index audit_logs_entity_entity_id_idx on public.audit_logs (entity, entity_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customer_profiles_updated_at
before update on public.customer_profiles
for each row execute function public.set_updated_at();

create trigger staff_profiles_updated_at
before update on public.staff_profiles
for each row execute function public.set_updated_at();

create trigger facilities_updated_at
before update on public.facilities
for each row execute function public.set_updated_at();

create trigger facility_addons_updated_at
before update on public.facility_addons
for each row execute function public.set_updated_at();

create trigger schedules_updated_at
before update on public.schedules
for each row execute function public.set_updated_at();

create trigger pricing_tiers_updated_at
before update on public.pricing_tiers
for each row execute function public.set_updated_at();

create trigger bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create trigger events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger notices_updated_at
before update on public.notices
for each row execute function public.set_updated_at();

create trigger dining_outlets_updated_at
before update on public.dining_outlets
for each row execute function public.set_updated_at();

create trigger dining_categories_updated_at
before update on public.dining_categories
for each row execute function public.set_updated_at();

create trigger menu_items_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();