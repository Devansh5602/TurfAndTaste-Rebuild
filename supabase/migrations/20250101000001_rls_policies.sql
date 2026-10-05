-- Migration: Row Level Security policies
-- Created: 2025-01-01
-- Description: RLS policies for all public tables. Customer and staff domains are strictly separated.

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

alter table public.customer_profiles enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_role_assignments enable row level security;
alter table public.facilities enable row level security;
alter table public.facility_addons enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.pricing_tiers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.events enable row level security;
alter table public.notices enable row level security;
alter table public.dining_outlets enable row level security;
alter table public.dining_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.inquiries enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Check if current user is a staff member
create or replace function public.is_staff()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.staff_profiles sp
    where sp.auth_user_id = auth.uid()
      and sp.active = true
  );
$$;

-- Check if current user is a customer (has customer profile)
create or replace function public.is_customer()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.customer_profiles cp
    where cp.id = auth.uid()
  );
$$;

-- Get current user's customer profile ID (only for customers)
create or replace function public.current_customer_id()
returns uuid language sql stable as $$
  select case when exists (
    select 1 from public.customer_profiles cp
    where cp.id = auth.uid()
  ) then auth.uid() else null end;
$$;

-- Get current user's staff profile ID (only for staff)
create or replace function public.current_staff_id()
returns uuid language sql stable as $$
  select sp.id from public.staff_profiles sp
  where sp.auth_user_id = auth.uid()
    and sp.active = true
  limit 1;
$$;

-- Check if staff has a specific permission
create or replace function public.staff_has_permission(permission_key text)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.staff_profiles sp
    join public.staff_role_assignments sra on sra.staff_profile_id = sp.id
    join public.role_permissions rp on rp.role_id = sra.role_id
    join public.permissions p on p.id = rp.permission_id
    where sp.auth_user_id = auth.uid()
      and sp.active = true
      and p.key = permission_key
  );
$$;

-- ============================================================
-- CUSTOMER_PROFILES POLICIES
-- ============================================================

-- Customers can read their own profile
create policy "customer_profiles_select_own"
on public.customer_profiles
for select
to authenticated
using (id = auth.uid());

-- Customers can update their own profile
create policy "customer_profiles_update_own"
on public.customer_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Staff with permission can read all customer profiles
create policy "customer_profiles_select_staff"
on public.customer_profiles
for select
to authenticated
using (public.staff_has_permission('customers.read'));

-- Staff with permission can update customer profiles (e.g., for support)
create policy "customer_profiles_update_staff"
on public.customer_profiles
for update
to authenticated
using (public.staff_has_permission('customers.write'))
with check (public.staff_has_permission('customers.write'));

-- ============================================================
-- STAFF_PROFILES POLICIES
-- ============================================================

-- Staff can read their own profile
create policy "staff_profiles_select_own"
on public.staff_profiles
for select
to authenticated
using (auth_user_id = auth.uid());

-- Staff with permission can read all staff profiles
create policy "staff_profiles_select_staff"
on public.staff_profiles
for select
to authenticated
using (public.staff_has_permission('staff.read'));

-- Staff with permission can manage staff profiles
create policy "staff_profiles_manage_staff"
on public.staff_profiles
for all
to authenticated
using (public.staff_has_permission('staff.write'))
with check (public.staff_has_permission('staff.write'));

-- ============================================================
-- ROLES & PERMISSIONS POLICIES
-- ============================================================

-- Staff with permission can read roles
create policy "roles_select_staff"
on public.roles
for select
to authenticated
using (public.staff_has_permission('roles.read'));

-- Staff with permission can manage roles
create policy "roles_manage_staff"
on public.roles
for all
to authenticated
using (public.staff_has_permission('roles.write'))
with check (public.staff_has_permission('roles.write'));

-- Staff with permission can read permissions
create policy "permissions_select_staff"
on public.permissions
for select
to authenticated
using (public.staff_has_permission('roles.read'));

-- Staff with permission can manage permissions
create policy "permissions_manage_staff"
on public.permissions
for all
to authenticated
using (public.staff_has_permission('roles.write'))
with check (public.staff_has_permission('roles.write'));

-- Staff with permission can read role_permissions
create policy "role_permissions_select_staff"
on public.role_permissions
for select
to authenticated
using (public.staff_has_permission('roles.read'));

-- Staff with permission can manage role_permissions
create policy "role_permissions_manage_staff"
on public.role_permissions
for all
to authenticated
using (public.staff_has_permission('roles.write'))
with check (public.staff_has_permission('roles.write'));

-- Staff with permission can read staff_role_assignments
create policy "staff_role_assignments_select_staff"
on public.staff_role_assignments
for select
to authenticated
using (public.staff_has_permission('staff.read'));

-- Staff with permission can manage staff_role_assignments
create policy "staff_role_assignments_manage_staff"
on public.staff_role_assignments
for all
to authenticated
using (public.staff_has_permission('staff.write'))
with check (public.staff_has_permission('staff.write'));

-- ============================================================
-- FACILITIES & ADD-ONS POLICIES
-- ============================================================

-- Anyone authenticated can read active facilities
create policy "facilities_select_active"
on public.facilities
for select
to authenticated
using (active = true);

-- Staff with permission can read all facilities (including inactive)
create policy "facilities_select_staff"
on public.facilities
for select
to authenticated
using (public.staff_has_permission('facilities.read'));

-- Staff with permission can manage facilities
create policy "facilities_manage_staff"
on public.facilities
for all
to authenticated
using (public.staff_has_permission('facilities.write'))
with check (public.staff_has_permission('facilities.write'));

-- Anyone authenticated can read active add-ons
create policy "facility_addons_select_active"
on public.facility_addons
for select
to authenticated
using (active = true);

-- Staff with permission can read all add-ons
create policy "facility_addons_select_staff"
on public.facility_addons
for select
to authenticated
using (public.staff_has_permission('facilities.read'));

-- Staff with permission can manage add-ons
create policy "facility_addons_manage_staff"
on public.facility_addons
for all
to authenticated
using (public.staff_has_permission('facilities.write'))
with check (public.staff_has_permission('facilities.write'));

-- ============================================================
-- SCHEDULES & OVERRIDES POLICIES
-- ============================================================

-- Anyone authenticated can read schedules
create policy "schedules_select"
on public.schedules
for select
to authenticated
using (true);

-- Staff with permission can manage schedules
create policy "schedules_manage_staff"
on public.schedules
for all
to authenticated
using (public.staff_has_permission('schedules.write'))
with check (public.staff_has_permission('schedules.write'));

-- Anyone authenticated can read schedule overrides
create policy "schedule_overrides_select"
on public.schedule_overrides
for select
to authenticated
using (true);

-- Staff with permission can manage schedule overrides
create policy "schedule_overrides_manage_staff"
on public.schedule_overrides
for all
to authenticated
using (public.staff_has_permission('schedules.write'))
with check (public.staff_has_permission('schedules.write'));

-- ============================================================
-- PRICING POLICIES
-- ============================================================

-- Anyone authenticated can read pricing tiers (for quotes)
create policy "pricing_tiers_select"
on public.pricing_tiers
for select
to authenticated
using (true);

-- Staff with permission can manage pricing
create policy "pricing_tiers_manage_staff"
on public.pricing_tiers
for all
to authenticated
using (public.staff_has_permission('pricing.write'))
with check (public.staff_has_permission('pricing.write'));

-- ============================================================
-- BOOKINGS POLICIES
-- ============================================================

-- Customers can read their own bookings
create policy "bookings_select_own"
on public.bookings
for select
to authenticated
using (customer_profile_id = auth.uid());

-- Customers can create bookings (status will be 'pending')
create policy "bookings_insert_own"
on public.bookings
for insert
to authenticated
with check (customer_profile_id = auth.uid());

-- Customers can update their own pending bookings (e.g., cancel)
create policy "bookings_update_own_pending"
on public.bookings
for update
to authenticated
using (customer_profile_id = auth.uid() and status = 'pending')
with check (customer_profile_id = auth.uid());

-- Staff with permission can read all bookings
create policy "bookings_select_staff"
on public.bookings
for select
to authenticated
using (public.staff_has_permission('bookings.read'));

-- Staff with permission can manage all bookings
create policy "bookings_manage_staff"
on public.bookings
for all
to authenticated
using (public.staff_has_permission('bookings.write'))
with check (public.staff_has_permission('bookings.write'));

-- ============================================================
-- BOOKING_ITEMS POLICIES
-- ============================================================

-- Customers can read their own booking items
create policy "booking_items_select_own"
on public.booking_items
for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_items.booking_id
      and b.customer_profile_id = auth.uid()
  )
);

-- Staff with permission can read all booking items
create policy "booking_items_select_staff"
on public.booking_items
for select
to authenticated
using (public.staff_has_permission('bookings.read'));

-- Staff with permission can manage booking items
create policy "booking_items_manage_staff"
on public.booking_items
for all
to authenticated
using (public.staff_has_permission('bookings.write'))
with check (public.staff_has_permission('bookings.write'));

-- ============================================================
-- PAYMENT_ORDERS POLICIES
-- ============================================================

-- Customers can read their own payment orders
create policy "payment_orders_select_own"
on public.payment_orders
for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = payment_orders.booking_id
      and b.customer_profile_id = auth.uid()
  )
);

-- Staff with permission can read all payment orders
create policy "payment_orders_select_staff"
on public.payment_orders
for select
to authenticated
using (public.staff_has_permission('payments.read'));

-- Service role (API) can insert/update payment orders
-- Note: API uses service role key which bypasses RLS

-- ============================================================
-- PAYMENTS POLICIES
-- ============================================================

-- Customers can read their own payments
create policy "payments_select_own"
on public.payments
for select
to authenticated
using (
  exists (
    select 1 from public.payment_orders po
    join public.bookings b on b.id = po.booking_id
    where po.id = payments.payment_order_id
      and b.customer_profile_id = auth.uid()
  )
);

-- Staff with permission can read all payments
create policy "payments_select_staff"
on public.payments
for select
to authenticated
using (public.staff_has_permission('payments.read'));

-- ============================================================
-- REVIEWS POLICIES
-- ============================================================

-- Anyone authenticated can read reviews (public content)
create policy "reviews_select"
on public.reviews
for select
to authenticated
using (true);

-- Customers can create reviews for their completed bookings
create policy "reviews_insert_own"
on public.reviews
for insert
to authenticated
with check (
  customer_profile_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = reviews.booking_id
      and b.customer_profile_id = auth.uid()
      and b.status = 'completed'
  )
);

-- Customers can update their own reviews
create policy "reviews_update_own"
on public.reviews
for update
to authenticated
using (customer_profile_id = auth.uid())
with check (customer_profile_id = auth.uid());

-- Staff with permission can read all reviews
create policy "reviews_select_staff"
on public.reviews
for select
to authenticated
using (public.staff_has_permission('reviews.read'));

-- Staff with permission can moderate reviews
create policy "reviews_moderate_staff"
on public.reviews
for update
to authenticated
using (public.staff_has_permission('reviews.moderate'))
with check (public.staff_has_permission('reviews.moderate'));

-- ============================================================
-- EVENTS & NOTICES POLICIES
-- ============================================================

-- Anyone authenticated can read published events
create policy "events_select_published"
on public.events
for select
to authenticated
using (published = true);

-- Staff with permission can read all events
create policy "events_select_staff"
on public.events
for select
to authenticated
using (public.staff_has_permission('events.read'));

-- Staff with permission can manage events
create policy "events_manage_staff"
on public.events
for all
to authenticated
using (public.staff_has_permission('events.write'))
with check (public.staff_has_permission('events.write'));

-- Anyone authenticated can read published notices
create policy "notices_select_published"
on public.notices
for select
to authenticated
using (published = true);

-- Staff with permission can read all notices
create policy "notices_select_staff"
on public.notices
for select
to authenticated
using (public.staff_has_permission('notices.read'));

-- Staff with permission can manage notices
create policy "notices_manage_staff"
on public.notices
for all
to authenticated
using (public.staff_has_permission('notices.write'))
with check (public.staff_has_permission('notices.write'));

-- ============================================================
-- DINING POLICIES
-- ============================================================

-- Anyone authenticated can read active dining outlets
create policy "dining_outlets_select_active"
on public.dining_outlets
for select
to authenticated
using (active = true);

-- Staff with permission can read all dining outlets
create policy "dining_outlets_select_staff"
on public.dining_outlets
for select
to authenticated
using (public.staff_has_permission('dining.read'));

-- Staff with permission can manage dining outlets
create policy "dining_outlets_manage_staff"
on public.dining_outlets
for all
to authenticated
using (public.staff_has_permission('dining.write'))
with check (public.staff_has_permission('dining.write'));

-- Anyone authenticated can read dining categories
create policy "dining_categories_select"
on public.dining_categories
for select
to authenticated
using (true);

-- Staff with permission can manage dining categories
create policy "dining_categories_manage_staff"
on public.dining_categories
for all
to authenticated
using (public.staff_has_permission('dining.write'))
with check (public.staff_has_permission('dining.write'));

-- Anyone authenticated can read available menu items
create policy "menu_items_select_available"
on public.menu_items
for select
to authenticated
using (available = true);

-- Staff with permission can read all menu items
create policy "menu_items_select_staff"
on public.menu_items
for select
to authenticated
using (public.staff_has_permission('dining.read'));

-- Staff with permission can manage menu items
create policy "menu_items_manage_staff"
on public.menu_items
for all
to authenticated
using (public.staff_has_permission('dining.write'))
with check (public.staff_has_permission('dining.write'));

-- ============================================================
-- INQUIRIES POLICIES
-- ============================================================

-- Customers can read their own inquiries
create policy "inquiries_select_own"
on public.inquiries
for select
to authenticated
using (customer_profile_id = auth.uid());

-- Customers can create inquiries
create policy "inquiries_insert_own"
on public.inquiries
for insert
to authenticated
with check (customer_profile_id = auth.uid());

-- Staff with permission can read all inquiries
create policy "inquiries_select_staff"
on public.inquiries
for select
to authenticated
using (public.staff_has_permission('inquiries.read'));

-- Staff with permission can manage inquiries
create policy "inquiries_manage_staff"
on public.inquiries
for all
to authenticated
using (public.staff_has_permission('inquiries.write'))
with check (public.staff_has_permission('inquiries.write'));

-- ============================================================
-- AUDIT_LOGS POLICIES
-- ============================================================

-- Staff with permission can read audit logs
create policy "audit_logs_select_staff"
on public.audit_logs
for select
to authenticated
using (public.staff_has_permission('audit.read'));

-- Service role (API) can insert audit logs
-- Note: API uses service role key which bypasses RLS