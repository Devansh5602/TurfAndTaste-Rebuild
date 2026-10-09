-- P0.2: whole-hour custom booking intervals and immutable per-hour quote pricing.
-- Existing 1-hour pricing tiers become the tariff for each constituent hour.
-- Existing quotes/bookings retain their stored totals; no financial history is recalculated.

alter table public.pricing_tiers
  drop constraint if exists pricing_tiers_duration_hours_check;

alter table public.pricing_tiers
  add constraint pricing_tiers_duration_hours_check check (duration_hours >= 1);

alter table public.booking_quotes
  drop constraint if exists booking_quotes_duration_hours_check;

alter table public.booking_quotes
  add column ends_at timestamptz,
  add column price_components jsonb not null default '[]'::jsonb,
  add constraint booking_quotes_duration_hours_check check (duration_hours >= 1);

update public.booking_quotes
set ends_at = starts_at + duration_hours * interval '1 hour'
where ends_at is null;

alter table public.booking_quotes
  alter column ends_at set not null,
  add constraint booking_quotes_valid_range check (ends_at > starts_at),
  add constraint booking_quotes_duration_matches_range check (
    ends_at = starts_at + duration_hours * interval '1 hour'
  ),
  add constraint booking_quotes_price_components_array check (
    jsonb_typeof(price_components) = 'array'
  );

alter table public.bookings
  drop constraint if exists bookings_duration_hours_check;

alter table public.bookings
  add constraint bookings_duration_hours_check check (duration_hours >= 1);

create index if not exists bookings_facility_interval_idx
  on public.bookings (facility_id, starts_at, ends_at)
  where status in ('pending', 'confirmed');

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

  -- quote_id is the idempotency boundary. Concurrent and lost-response retries
  -- converge on the customer-owned booking created from this immutable quote.
  select id into v_booking_id
  from public.bookings
  where quote_id = v_quote.id
    and customer_profile_id = p_customer_profile_id;

  if found then
    return v_booking_id;
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
    v_quote.ends_at,
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
