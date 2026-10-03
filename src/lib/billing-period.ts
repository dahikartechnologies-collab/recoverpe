import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { RECOVERPE_TIMEZONE } from "@/lib/timezone";

export interface BillingPeriod {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  source: "subscription" | "calendar_month";
}

export type UsageCountWindow = {
  source: BillingPeriod["source"];
  startIso: string;
  endIso: string;
  month: string | null;
};

export interface UsageMonthOption {
  value: string;
  label: string;
  isCurrent: boolean;
}

const USAGE_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseUsageMonthParam(
  raw: string | null | undefined
): string | null {
  const value = raw?.trim() ?? "";

  if (!USAGE_MONTH_PATTERN.test(value)) {
    return null;
  }

  return value;
}

export function calendarMonthPeriod(year: number, month: number): BillingPeriod {
  const monthToken = String(month).padStart(2, "0");
  const start = fromZonedTime(
    `${year}-${monthToken}-01T00:00:00`,
    RECOVERPE_TIMEZONE
  );
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

function istCalendarMonthPeriod(now: Date): BillingPeriod {
  const yearMonth = formatInTimeZone(now, RECOVERPE_TIMEZONE, "yyyy-MM");
  const [year, month] = yearMonth.split("-").map(Number);
  return calendarMonthPeriod(year, month);
}

export function listUsageMonthOptions(now = new Date()): UsageMonthOption[] {
  const current = formatInTimeZone(now, RECOVERPE_TIMEZONE, "yyyy-MM");
  const [year, month] = current.split("-").map(Number);
  const options: UsageMonthOption[] = [];

  for (let offset = 0; offset < 12; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);

    options.push({
      value,
      label: offset === 0 ? `${label} (Current)` : label,
      isCurrent: offset === 0,
    });
  }

  return options;
}

export function formatUsageMonthLabel(yearMonth: string): string {
  const parsed = parseUsageMonthParam(yearMonth);

  if (!parsed) {
    return "this month";
  }

  const [year, month] = parsed.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function resolveUsageCountWindow(input: {
  subscriptionCurrentPeriodEnd?: string | null;
  subscriptionInterval?: "monthly" | "annual" | string | null;
  now?: Date;
  month?: string | null;
}): UsageCountWindow {
  const requestedMonth = parseUsageMonthParam(input.month);

  if (requestedMonth) {
    const [year, month] = requestedMonth.split("-").map(Number);
    const period = calendarMonthPeriod(year, month);

    return {
      source: "calendar_month",
      startIso: period.startIso,
      endIso: period.endIso,
      month: requestedMonth,
    };
  }

  const period = resolveCurrentBillingPeriod(input);

  return {
    source: period.source,
    startIso: period.startIso,
    endIso: period.endIso,
    month:
      period.source === "calendar_month"
        ? formatInTimeZone(period.start, RECOVERPE_TIMEZONE, "yyyy-MM")
        : null,
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
