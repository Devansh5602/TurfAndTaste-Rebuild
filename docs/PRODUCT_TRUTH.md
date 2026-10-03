# Product truth

This document is non-negotiable. Do not change it silently. A product change requires an explicit decision recorded here and in `docs/DECISIONS.md`.

## Property

Turf & Taste is one physical property in Patan, Gujarat, India.

It is not:

- a marketplace
- a city-wide venue discovery platform
- a Bopal or Ahmedabad sports platform
- a multi-property chain

## Authorized sports and services

1. Box Cricket
2. Skating Rink
3. Pickle Ball
4. Cricket Green Net Practice
5. Cricket Green Net Practice with Shooting Machine

The shooting machine is an add-on for Cricket Green Net Practice. It is not an independent facility.

Do not introduce Football, Tennis, Padel, Badminton, Basketball, Squash, Golf, or any sport that is not listed above.

## Dining

Dining is information, discovery, and CMS only.

The customer application must not contain food ordering, a food cart, food checkout, delivery, food payment, or table reservation unless a later explicit approval changes this document.

The dining model may contain outlets, categories, menu items, availability, descriptions, prices, imagery, and CMS management.

## Booking duration

The baseline durations are 1 hour and 2 hours. Do not introduce 1.5-hour bookings unless this document changes.

## Hours

The architecture must support a 24/7 facility model. Individual availability is still controlled by schedules, closures, overrides, and maintenance.

## Time

Business dates and schedules use `Asia/Kolkata`. Persisted instants use timezone-aware timestamps.

## Authorization domains

Customer authentication and admin/staff authentication are separate. A customer session must not grant admin access.

Role and permission checks are enforced by the API and database, not only by hidden UI.

## Server authority

The server is authoritative for the current time, slot availability, operating schedule, booking eligibility, pricing, surcharges, final totals, quote expiry, booking creation, and payment verification.

The client must not be trusted to calculate the final payable amount or to confirm a payment.
