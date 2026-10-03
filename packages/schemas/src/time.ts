import { PROPERTY } from '@turf-and-taste/types';
import { formatInTimeZone } from 'date-fns-tz';

export const BUSINESS_TIME_ZONE = PROPERTY.timeZone;

export function businessDate(instant: Date): string {
  return formatInTimeZone(instant, BUSINESS_TIME_ZONE, 'yyyy-MM-dd');
}
