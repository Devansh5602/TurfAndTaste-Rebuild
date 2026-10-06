-- Phase 3 booking integrity: durable quotes, authoritative writes, and collision safety.

create extension if not exists btree_gist;

create or replace function public.provision_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.customer_profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Customer'),
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.provision_customer_profile() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.provision_customer_profile();

insert into public.customer_profiles (id, full_name, email, phone)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'Customer'),
  u.email,
  u.phone
from auth.users u
left join public.customer_profiles cp on cp.id = u.id
where cp.id is null;

create table public.booking_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles (id) on delete cascade,
  facility_id uuid not null references public.facilities (id),
  facility_key text not null check (facility_key in ('box-cricket', 'skating-rink', 'pickle-ball', 'cricket-green-net')),
  addon_id uuid references public.facility_addons (id),
  addon_key text check (addon_key is null or addon_key = 'shooting-machine'),
  starts_at timestamptz not null,
  duration_hours smallint not null check (duration_hours in (1, 2)),
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint booking_quotes_expiry_after_creation check (expires_at > created_at),
  constraint booking_quotes_addon_pair check (
    (addon_id is null and addon_key is null) or
    (addon_id is not null and addon_key = 'shooting-machine')
  )
);

alter table public.booking_quotes enable row level security;

create policy "booking_quotes_select_own"
on public.booking_quotes
for select
to authenticated
using (customer_profile_id = auth.uid());

alter table public.bookings
  add column facility_id uuid references public.facilities (id),
  add column addon_id uuid references public.facility_addons (id),
  add column quote_id uuid references public.booking_quotes (id),
  add column ends_at timestamptz;

update public.bookings
set ends_at = starts_at + duration_hours * interval '1 hour'
where ends_at is null;

update public.bookings b
set facility_id = bi.facility_id,
    addon_id = bi.addon_id
from (
  select distinct on (booking_id) booking_id, facility_id, addon_id
  from public.booking_items
  order by booking_id, id
) bi
where bi.booking_id = b.id
  and b.facility_id is null;

-- Existing orphan rows indicate invalid pre-Phase-3 data and must block deployment.
alter table public.bookings alter column facility_id set not null;
alter table public.bookings alter column ends_at set not null;

alter table public.booking_items
  add constraint booking_items_one_per_booking unique (booking_id);

alter table public.schedules
  add constraint schedules_facility_weekday_unique unique (facility_id, weekday);

alter table public.schedule_overrides
  add constraint schedule_overrides_valid_range check (ends_at > starts_at);

alter table public.pricing_tiers
  add constraint pricing_tiers_valid_range check (effective_to is null or effective_to > effective_from);

alter table public.bookings
  add constraint bookings_quote_unique unique (quote_id),
  add constraint bookings_quote_expiry_required check (quote_expires_at is not null),
  add constraint bookings_valid_range check (ends_at > starts_at),
  add constraint bookings_duration_matches_range check (
    ends_at = starts_at + duration_hours * interval '1 hour'
  ),
  add constraint bookings_no_overlap
  exclude using gist (
    facility_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'));

-- Customers may read their own records, but all authoritative writes go through the API.
drop policy if exists "bookings_insert_own" on public.bookings;
drop policy if exists "bookings_update_own_pending" on public.bookings;

create or replace function public.create_booking_from_quote(
  p_customer_profile_id uuid,
  p_quote_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.booking_quotes%rowtype;
  v_booking_id uuid;
begin
  select * into v_quote
  from public.booking_quotes
  where id = p_quote_id
  for update;

  if not found or v_quote.customer_profile_id <> p_customer_profile_id then
    raise exception using errcode = 'P0001', message = 'QUOTE_NOT_FOUND';
  end if;

  if v_quote.consumed_at is not null then
    raise exception using errcode = 'P0001', message = 'QUOTE_CONSUMED';
  end if;

  if v_quote.expires_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'QUOTE_EXPIRED';
  end if;

  insert into public.bookings (
    customer_profile_id,
    facility_id,
    addon_id,
    quote_id,
    status,
    starts_at,
    ends_at,
    duration_hours,
    quoted_amount_paise,
    currency,
    quote_expires_at
  ) values (
    p_customer_profile_id,
    v_quote.facility_id,
    v_quote.addon_id,
    v_quote.id,
    'pending',
    v_quote.starts_at,
    v_quote.starts_at + v_quote.duration_hours * interval '1 hour',
    v_quote.duration_hours,
    v_quote.amount_paise,
    v_quote.currency,
    v_quote.expires_at
  ) returning id into v_booking_id;

  insert into public.booking_items (
    booking_id,
    facility_id,
    addon_id,
    amount_paise
  ) values (
    v_booking_id,
    v_quote.facility_id,
    v_quote.addon_id,
    v_quote.amount_paise
  );

  update public.booking_quotes
  set consumed_at = clock_timestamp()
  where id = v_quote.id;

  return v_booking_id;
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'SLOT_CONFLICT';
end;
$$;

revoke all on function public.create_booking_from_quote(uuid, uuid) from public;
revoke all on function public.create_booking_from_quote(uuid, uuid) from anon;
revoke all on function public.create_booking_from_quote(uuid, uuid) from authenticated;
grant execute on function public.create_booking_from_quote(uuid, uuid) to service_role;

create index booking_quotes_customer_created_idx
  on public.booking_quotes (customer_profile_id, created_at desc);
create index booking_quotes_expiry_idx
  on public.booking_quotes (expires_at)
  where consumed_at is null;
create index bookings_facility_starts_v2_idx
  on public.bookings (facility_id, starts_at);
