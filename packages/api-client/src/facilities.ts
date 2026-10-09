import { ApiClientError, publicRequest } from './client';
import type { BookingDurationHours, FacilityKey } from '@turf-and-taste/types';

export interface Facility {
  id: string;
  key: FacilityKey;
  name: string;
  active: boolean;
}

export interface FacilityAddon {
  id: string;
  facility_id: string;
  key: 'shooting-machine';
  name: string;
  active: boolean;
}

export interface FacilityWithAddons extends Facility {
  addons: FacilityAddon[];
}

export interface Schedule {
  id: string;
  facility_id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
}

export interface PricingTier {
  id: string;
  facility_id: string;
  addon_id: string | null;
  duration_hours: BookingDurationHours;
  amount_paise: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
}

export async function getFacilities(baseUrl: string): Promise<Facility[]> {
  return publicRequest<Facility[]>(baseUrl, '/api/v1/facilities');
}

export async function getFacility(
  baseUrl: string,
  key: FacilityKey,
): Promise<FacilityWithAddons | null> {
  try {
    return await publicRequest<FacilityWithAddons | null>(baseUrl, `/api/v1/facilities/${key}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getFacilitySchedule(baseUrl: string, key: FacilityKey): Promise<Schedule[]> {
  return publicRequest<Schedule[]>(baseUrl, `/api/v1/facilities/${key}/schedule`);
}

export async function getFacilityPricing(
  baseUrl: string,
  key: FacilityKey,
): Promise<PricingTier[]> {
  return publicRequest<PricingTier[]>(baseUrl, `/api/v1/facilities/${key}/pricing`);
}
