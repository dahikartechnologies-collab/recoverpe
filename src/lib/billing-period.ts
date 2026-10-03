import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { RECOVERPE_TIMEZONE } from "@/lib/timezone";

export interface BillingPeriod {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  source: "subscription" | "calendar_month";
}

function istCalendarMonthPeriod(now: Date): BillingPeriod {
  const yearMonth = formatInTimeZone(now, RECOVERPE_TIMEZONE, "yyyy-MM");
  const [year, month] = yearMonth.split("-").map(Number);
  const monthToken = String(month).padStart(2, "0");
  const start = fromZonedTime(`${year}-${monthToken}-01T00:00:00`, RECOVERPE_TIMEZONE);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextToken = String(nextMonth).padStart(2, "0");
  const end = fromZonedTime(
    `${nextYear}-${nextToken}-01T00:00:00`,
    RECOVERPE_TIMEZONE
  );

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    source: "calendar_month",
  };
}

export function resolveCurrentBillingPeriod(input: {
  subscriptionCurrentPeriodEnd?: string | null;
  subscriptionInterval?: "monthly" | "annual" | string | null;
  now?: Date;
}): BillingPeriod {
  const now = input.now ?? new Date();
  const periodEndRaw = input.subscriptionCurrentPeriodEnd?.trim();

  if (periodEndRaw) {
    const periodEnd = new Date(periodEndRaw);

    if (!Number.isNaN(periodEnd.getTime()) && periodEnd.getTime() > now.getTime()) {
      const start = new Date(periodEnd.getTime());

      if (input.subscriptionInterval === "annual") {
        start.setUTCFullYear(start.getUTCFullYear() - 1);
      } else {
        start.setUTCMonth(start.getUTCMonth() - 1);
      }

      if (start.getTime() <= now.getTime()) {
        return {
          start,
          end: periodEnd,
          startIso: start.toISOString(),
          endIso: periodEnd.toISOString(),
          source: "subscription",
        };
      }
    }
  }

  return istCalendarMonthPeriod(now);
}
