export const PROPERTY = {
  name: 'Turf & Taste',
  locality: 'Patan',
  region: 'Gujarat',
  country: 'India',
  timeZone: 'Asia/Kolkata',
} as const;

export const FACILITY_KEYS = [
  'box-cricket',
  'skating-rink',
  'pickle-ball',
  'cricket-green-net',
] as const;

export type FacilityKey = (typeof FACILITY_KEYS)[number];

export const FACILITY_LABELS: Record<FacilityKey, string> = {
  'box-cricket': 'Box Cricket',
  'skating-rink': 'Skating Rink',
  'pickle-ball': 'Pickle Ball',
  'cricket-green-net': 'Cricket Green Net Practice',
};

export const ADD_ON_KEYS = ['shooting-machine'] as const;

export type AddOnKey = (typeof ADD_ON_KEYS)[number];

export const ADD_ON_LABELS: Record<AddOnKey, string> = {
  'shooting-machine': 'Shooting Machine',
};

export const BOOKING_DURATION_HOURS = [1, 2] as const;

export type BookingDurationHours = (typeof BOOKING_DURATION_HOURS)[number];

export const AUTH_DOMAINS = ['customer', 'staff'] as const;

export type AuthDomain = (typeof AUTH_DOMAINS)[number];
