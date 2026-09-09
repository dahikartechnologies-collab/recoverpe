import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const RECOVERPE_TIMEZONE = "Asia/Kolkata";

export function getTodayDateStringInIst(now = new Date()): string {
  return formatInTimeZone(now, RECOVERPE_TIMEZONE, "yyyy-MM-dd");
}

export function getIstDayBounds(referenceDate: string): {
  startIso: string;
  endIso: string;
} {
  const startIso = fromZonedTime(
    `${referenceDate}T00:00:00`,
    RECOVERPE_TIMEZONE
  ).toISOString();
  const endIso = fromZonedTime(
    `${referenceDate}T23:59:59.999`,
    RECOVERPE_TIMEZONE
  ).toISOString();

  return { startIso, endIso };
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function daysBetweenDateOnly(fromDate: string, toDate: string): number {
  const from = parseDateOnly(fromDate);
  const to = parseDateOnly(toDate);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.round((to.getTime() - from.getTime()) / millisecondsPerDay);
}
