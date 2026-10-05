-- Migration: Development seed data for Turf & Taste
-- Created: 2025-01-01
-- Description: Deterministic seed data for the single Patan property.
-- Only authorized sports/services are included. No production data.

-- ============================================================
-- FACILITIES (Authorized sports/services only)
-- ============================================================

insert into public.facilities (key, name, active) values
  ('box-cricket', 'Box Cricket', true),
  ('skating-rink', 'Skating Rink', true),
  ('pickle-ball', 'Pickle Ball', true),
  ('cricket-green-net', 'Cricket Green Net Practice', true)
on conflict (key) do nothing;

-- ============================================================
-- FACILITY ADD-ONS
-- ============================================================

-- Shooting machine is only available for Cricket Green Net Practice
insert into public.facility_addons (facility_id, key, name, active)
select f.id, 'shooting-machine', 'Shooting Machine', true
from public.facilities f
where f.key = 'cricket-green-net'
on conflict (facility_id, key) do nothing;

-- ============================================================
-- SCHEDULES (Default: 6 AM - 10 PM daily, Asia/Kolkata)
-- ============================================================

-- Weekday 0 = Sunday, 6 = Saturday
-- All facilities open 06:00 - 22:00 by default
insert into public.schedules (facility_id, weekday, opens_at, closes_at)
select f.id, w.weekday, '06:00'::time, '22:00'::time
from public.facilities f
cross join (
  values (0), (1), (2), (3), (4), (5), (6)
) as w(weekday)
on conflict do nothing;

-- ============================================================
-- PRICING TIERS (Sample pricing in paise, INR)
-- Effective from 2025-01-01, no end date
-- Standard pricing (can be overridden by admin later)
-- ============================================================

-- Box Cricket: 1hr = 800, 2hr = 1500
insert into public.pricing_tiers (facility_id, addon_id, duration_hours, amount_paise, currency, effective_from)
select f.id, null, 1, 80000, 'INR', '2025-01-01 00:00:00+05:30'
from public.facilities f where f.key = 'box-cricket'
on conflict do nothing;

insert into public.pricing_tiers (facility_id, addon_id, duration_hours, amount_paise, currency, effective_from)
select f.id, null, 2, 150000, 'INR', '2025-01-01 00:00:00+05:30'
from public.facilities f where f.key = 'box-cricket'
on conflict do nothing;

-- Skating Rink: 1hr = 500, 2hr = 900
insert into public.pricing_tiers (facility_id, addon_id, duration_hours, amount_paise, currency, effective_from)
select f.id, null, 1, 50000, 'INR', '2025-01-01 00:00:00+05:30'
from public.facilities f where f.key = 'skating-rink'
on conflict do nothing;

insert into public.pricing_tiers (facility_id, addon_id, duration_hours, amount_paise, currency, effective_from)
select f.id, null, 2, 90000, 'INR', '2025-01-01 00:00:00+05:30'
from public.facilities f where f.key = 'skating-rink'
on conflict do nothing;

-- Pickle Ball: 1hr = 600, 2hr = 1100
insert into public.pricing_tiers (facility_id, addon_id, duration_hours, amount_paise, currency, effective_from)
select f.id, null, 1, 60000, 'INR', '2025-01-01 00:00:00+05:30'
from public.facilities f where f.key = 'pickle-ball'
on conflict do nothing;

insert into public.pricing_tiers (facility_id, addon_id, duration_hours, amount_paise, currency, effective_from)
select f.id, null, 2, 110000, 'INR', '2025-01-01 00:00:00+05:30'
from public.facilities f where f.key = 'pickle-ball'
on conflict do nothing;

-- Cricket Green Net Practice: 1hr = 700, 2hr = 1300
insert into public.pricing_tiers (facility_id, addon_id, duration_hours, amount_paise, currency, effective_from)
select f.id, null, 1, 70000, 'INR', '2025-01-01 00:00:00+05:30'
from public.facilities f where f.key = 'cricket-green-net'
on conflict do nothing;

insert into public.pricing_tiers (facility_id, addon_id, duration_hours, amount_paise, currency, effective_from)
select f.id, null, 2, 130000, 'INR', '2025-01-01 00:00:00+05:30'
from public.facilities f where f.key = 'cricket-green-net'
on conflict do nothing;

-- Cricket Green Net + Shooting Machine: 1hr = 1000, 2hr = 1900
insert into public.pricing_tiers (facility_id, addon_id, duration_hours, amount_paise, currency, effective_from)
select f.id, fa.id, 1, 100000, 'INR', '2025-01-01 00:00:00+05:30'
from public.facilities f
join public.facility_addons fa on fa.facility_id = f.id
where f.key = 'cricket-green-net' and fa.key = 'shooting-machine'
on conflict do nothing;

insert into public.pricing_tiers (facility_id, addon_id, duration_hours, amount_paise, currency, effective_from)
select f.id, fa.id, 2, 190000, 'INR', '2025-01-01 00:00:00+05:30'
from public.facilities f
join public.facility_addons fa on fa.facility_id = f.id
where f.key = 'cricket-green-net' and fa.key = 'shooting-machine'
on conflict do nothing;

-- ============================================================
-- ROLES & PERMISSIONS
-- ============================================================

-- Permissions
insert into public.permissions (key, description) values
  ('customers.read', 'View customer profiles and bookings'),
  ('customers.write', 'Manage customer profiles'),
  ('staff.read', 'View staff profiles and assignments'),
  ('staff.write', 'Manage staff profiles and role assignments'),
  ('roles.read', 'View roles and permissions'),
  ('roles.write', 'Manage roles and permissions'),
  ('facilities.read', 'View facilities and add-ons'),
  ('facilities.write', 'Manage facilities and add-ons'),
  ('schedules.read', 'View schedules and overrides'),
  ('schedules.write', 'Manage schedules and overrides'),
  ('pricing.read', 'View pricing tiers'),
  ('pricing.write', 'Manage pricing tiers'),
  ('bookings.read', 'View all bookings'),
  ('bookings.write', 'Manage all bookings'),
  ('payments.read', 'View payments and orders'),
  ('payments.write', 'Manage payments (refunds, etc.)'),
  ('reviews.read', 'View reviews'),
  ('reviews.moderate', 'Moderate reviews'),
  ('events.read', 'View events'),
  ('events.write', 'Manage events'),
  ('notices.read', 'View notices'),
  ('notices.write', 'Manage notices'),
  ('dining.read', 'View dining content'),
  ('dining.write', 'Manage dining content'),
  ('inquiries.read', 'View inquiries'),
  ('inquiries.write', 'Manage inquiries'),
  ('audit.read', 'View audit logs')
on conflict (key) do nothing;

-- Roles
insert into public.roles (key, name) values
  ('super_admin', 'Super Administrator'),
  ('manager', 'Facility Manager'),
  ('staff', 'Staff Member'),
  ('front_desk', 'Front Desk')
on conflict (key) do nothing;

-- Super Admin: all permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'super_admin'
on conflict do nothing;

-- Manager: most permissions except roles/staff management
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'customers.read', 'customers.write',
  'staff.read',
  'facilities.read', 'facilities.write',
  'schedules.read', 'schedules.write',
  'pricing.read', 'pricing.write',
  'bookings.read', 'bookings.write',
  'payments.read', 'payments.write',
  'reviews.read', 'reviews.moderate',
  'events.read', 'events.write',
  'notices.read', 'notices.write',
  'dining.read', 'dining.write',
  'inquiries.read', 'inquiries.write',
  'audit.read'
)
where r.key = 'manager'
on conflict do nothing;

-- Staff: read-mostly permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'customers.read',
  'facilities.read',
  'schedules.read',
  'pricing.read',
  'bookings.read',
  'payments.read',
  'reviews.read',
  'events.read',
  'notices.read',
  'dining.read',
  'inquiries.read', 'inquiries.write'
)
where r.key = 'staff'
on conflict do nothing;

-- Front Desk: booking and customer focused
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'customers.read', 'customers.write',
  'facilities.read',
  'schedules.read',
  'pricing.read',
  'bookings.read', 'bookings.write',
  'payments.read',
  'inquiries.read', 'inquiries.write'
)
where r.key = 'front_desk'
on conflict do nothing;

-- ============================================================
-- DINING (Sample outlets for development)
-- ============================================================

insert into public.dining_outlets (name, description, active) values
  ('Turf Café', 'Light bites and beverages near the turfs', true),
  ('The Pavilion', 'Sit-down dining with Indian and continental menu', true)
on conflict do nothing;

insert into public.dining_categories (outlet_id, name, sort_order)
select do.id, 'Beverages', 1
from public.dining_outlets do where do.name = 'Turf Café'
on conflict do nothing;

insert into public.dining_categories (outlet_id, name, sort_order)
select do.id, 'Snacks', 2
from public.dining_outlets do where do.name = 'Turf Café'
on conflict do nothing;

insert into public.dining_categories (outlet_id, name, sort_order)
select do.id, 'Starters', 1
from public.dining_outlets do where do.name = 'The Pavilion'
on conflict do nothing;

insert into public.dining_categories (outlet_id, name, sort_order)
select do.id, 'Main Course', 2
from public.dining_outlets do where do.name = 'The Pavilion'
on conflict do nothing;

insert into public.menu_items (category_id, name, description, price_paise, available)
select dc.id, 'Masala Chai', 'Traditional Indian spiced tea', 3000, true
from public.dining_categories dc
join public.dining_outlets do on do.id = dc.outlet_id
where do.name = 'Turf Café' and dc.name = 'Beverages'
on conflict do nothing;

insert into public.menu_items (category_id, name, description, price_paise, available)
select dc.id, 'Cold Coffee', 'Chilled coffee with ice cream', 8000, true
from public.dining_categories dc
join public.dining_outlets do on do.id = dc.outlet_id
where do.name = 'Turf Café' and dc.name = 'Beverages'
on conflict do nothing;

insert into public.menu_items (category_id, name, description, price_paise, available)
select dc.id, 'Veg Sandwich', 'Grilled vegetable sandwich with chutney', 12000, true
from public.dining_categories dc
join public.dining_outlets do on do.id = dc.outlet_id
where do.name = 'Turf Café' and dc.name = 'Snacks'
on conflict do nothing;

insert into public.menu_items (category_id, name, description, price_paise, available)
select dc.id, 'French Fries', 'Crispy golden fries with peri-peri seasoning', 9000, true
from public.dining_categories dc
join public.dining_outlets do on do.id = dc.outlet_id
where do.name = 'Turf Café' and dc.name = 'Snacks'
on conflict do nothing;

insert into public.menu_items (category_id, name, description, price_paise, available)
select dc.id, 'Paneer Tikka', 'Marinated cottage cheese grilled to perfection', 18000, true
from public.dining_categories dc
join public.dining_outlets do on do.id = dc.outlet_id
where do.name = 'The Pavilion' and dc.name = 'Starters'
on conflict do nothing;

insert into public.menu_items (category_id, name, description, price_paise, available)
select dc.id, 'Chicken Tikka', 'Boneless chicken marinated in yogurt and spices', 22000, true
from public.dining_categories dc
join public.dining_outlets do on do.id = dc.outlet_id
where do.name = 'The Pavilion' and dc.name = 'Starters'
on conflict do nothing;

insert into public.menu_items (category_id, name, description, price_paise, available)
select dc.id, 'Veg Biryani', 'Fragrant basmati rice with mixed vegetables', 16000, true
from public.dining_categories dc
join public.dining_outlets do on do.id = dc.outlet_id
where do.name = 'The Pavilion' and dc.name = 'Main Course'
on conflict do nothing;

insert into public.menu_items (category_id, name, description, price_paise, available)
select dc.id, 'Butter Chicken', 'Classic North Indian curry with naan', 24000, true
from public.dining_categories dc
join public.dining_outlets do on do.id = dc.outlet_id
where do.name = 'The Pavilion' and dc.name = 'Main Course'
on conflict do nothing;

-- ============================================================
-- EVENTS & NOTICES (Sample for development)
-- ============================================================

insert into public.events (title, body, starts_at, published) values
  ('Summer Cricket Camp', 'Join our 4-week intensive cricket coaching camp for ages 8-16. Professional coaches, certified curriculum.', '2025-04-01 08:00:00+05:30', true),
  ('Skating Workshop', 'Beginner-friendly skating workshop every Saturday. Equipment provided.', '2025-04-05 10:00:00+05:30', true)
on conflict do nothing;

insert into public.notices (title, body, published) values
  ('Monsoon Schedule Update', 'During monsoon season (June-Sept), outdoor facilities may have modified hours. Check the app for real-time updates.', true),
  ('New Pickle Ball Courts', 'We have added two new pickle ball courts! Bookings open from next week.', true)
on conflict do nothing;