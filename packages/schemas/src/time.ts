import { PROPERTY } from '@turf-and-taste/types';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const BUSINESS_TIME_ZONE = PROPERTY.timeZone;

export function businessDate(instant: Date): string {
  return formatInTimeZone(instant, BUSINESS_TIME_ZONE, 'yyyy-MM-dd');
}

export function businessWeekday(instant: Date): number {
  return Number(formatInTimeZone(instant, BUSINESS_TIME_ZONE, 'i')) % 7;
}

export function businessDateTime(date: string, time: string): Date {
  return fromZonedTime(`${date}T${time}:00`, BUSINESS_TIME_ZONE);
}

export function businessTime(instant: Date): string {
  return formatInTimeZone(instant, BUSINESS_TIME_ZONE, 'HH:mm');
}
