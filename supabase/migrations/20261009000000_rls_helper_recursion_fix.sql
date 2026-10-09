-- Migration: Fix RLS recursion in permission helper functions
-- Created: 2026-10-09
-- Description:
--   Every permission helper used inside RLS policies (staff_has_permission, is_staff,
--   current_staff_id, is_customer, current_customer_id) queried staff_profiles or
--   customer_profiles as SECURITY INVOKER. A policy on staff_profiles that calls
--   staff_has_permission() therefore re-entered the staff_profiles policies
--   (staff_profiles_select_staff -> staff_has_permission -> staff_profiles -> ...),
--   and Postgres aborted the query with "stack depth limit exceeded" after burning
--   stack for ~18 seconds. Because the customer API resolves the caller's profile
--   with the caller's JWT (PostgREST role "authenticated"), every authenticated
--   endpoint (availability, quotes, bookings, payments, profile) failed and the API
--   reported it as 401 UNAUTHENTICATED.
--   Fix: make the helper functions SECURITY DEFINER (owned by postgres, the migration
--   role) so their internal reads bypass RLS and the cycle is broken. The helpers
--   only derive a boolean/uuid from auth.uid(), so no additional data is exposed.
--   search_path is pinned and PUBLIC execute is revoked, matching the hardening
--   already applied to provision_customer_profile().

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.staff_profiles sp
    where sp.auth_user_id = auth.uid()
      and sp.active = true
  );
$$;

create or replace function public.is_customer()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.customer_profiles cp
    where cp.id = auth.uid()
  );
$$;

create or replace function public.current_customer_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select case when exists (
    select 1 from public.customer_profiles cp
    where cp.id = auth.uid()
  ) then auth.uid() else null end;
$$;

create or replace function public.current_staff_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select sp.id from public.staff_profiles sp
  where sp.auth_user_id = auth.uid()
    and sp.active = true
  limit 1;
$$;

create or replace function public.staff_has_permission(permission_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
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

revoke all on function public.is_staff() from public;
revoke all on function public.is_customer() from public;
revoke all on function public.current_customer_id() from public;
revoke all on function public.current_staff_id() from public;
revoke all on function public.staff_has_permission(text) from public;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_customer() to authenticated;
grant execute on function public.current_customer_id() to authenticated;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.staff_has_permission(text) to authenticated;
