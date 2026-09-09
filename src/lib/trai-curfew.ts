import { formatInTimeZone } from "date-fns-tz";
import { RECOVERPE_TIMEZONE } from "@/lib/timezone";

/** TRAI quiet hours: 7:00 PM – 9:00 AM IST (no automated outbound comms). */
export function isTraiCurfewActive(now = new Date()): boolean {
  const hour = Number.parseInt(
    formatInTimeZone(now, RECOVERPE_TIMEZONE, "H"),
    10
  );

  return hour >= 19 || hour < 9;
}

export function getTraiCurfewMessage(): string {
  return "Automated outbound communications are suppressed between 7:00 PM and 9:00 AM IST per TRAI guidelines.";
}
