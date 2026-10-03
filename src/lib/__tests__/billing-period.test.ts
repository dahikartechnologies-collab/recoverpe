import { describe, expect, it } from "vitest";
import { resolveCurrentBillingPeriod, resolveUsageCountWindow, listUsageMonthOptions } from "@/lib/billing-period";

describe("resolveCurrentBillingPeriod", () => {
  it("uses the Razorpay period when current_period_end is in the future", () => {
    const now = new Date("2026-10-03T09:00:00.000Z");
    const period = resolveCurrentBillingPeriod({
      subscriptionCurrentPeriodEnd: "2026-10-20T00:00:00.000Z",
      subscriptionInterval: "monthly",
      now,
    });

    expect(period.source).toBe("subscription");
    expect(period.endIso).toBe("2026-10-20T00:00:00.000Z");
    expect(period.startIso).toBe("2026-09-20T00:00:00.000Z");
  });

  it("falls back to the IST calendar month when no subscription period exists", () => {
    const now = new Date("2026-10-03T09:00:00.000Z");
    const period = resolveCurrentBillingPeriod({ now });

    expect(period.source).toBe("calendar_month");
    expect(period.startIso).toBe("2026-09-30T18:30:00.000Z");
    expect(period.endIso).toBe("2026-10-31T18:30:00.000Z");
  });

  it("falls back to the IST month when the billed period has already ended", () => {
    const now = new Date("2026-10-03T09:00:00.000Z");
    const period = resolveCurrentBillingPeriod({
      subscriptionCurrentPeriodEnd: "2026-09-01T00:00:00.000Z",
      subscriptionInterval: "monthly",
      now,
    });

    expect(period.source).toBe("calendar_month");
  });
});

describe("resolveUsageCountWindow", () => {
  it("uses the Razorpay window for live usage cards when a period is active", () => {
    const window = resolveUsageCountWindow({
      subscriptionCurrentPeriodEnd: "2026-10-20T00:00:00.000Z",
      subscriptionInterval: "monthly",
      now: new Date("2026-10-03T09:00:00.000Z"),
    });

    expect(window).toEqual({
      source: "subscription",
      startIso: "2026-09-20T00:00:00.000Z",
      endIso: "2026-10-20T00:00:00.000Z",
      month: null,
    });
  });

  it("uses the IST calendar month when there is no active subscription period", () => {
    const window = resolveUsageCountWindow({
      now: new Date("2026-10-03T09:00:00.000Z"),
    });

    expect(window).toEqual({
      source: "calendar_month",
      startIso: "2026-09-30T18:30:00.000Z",
      endIso: "2026-10-31T18:30:00.000Z",
      month: "2026-10",
    });
  });

  it("uses an explicit historical calendar month when month is provided", () => {
    const window = resolveUsageCountWindow({
      subscriptionCurrentPeriodEnd: "2026-10-20T00:00:00.000Z",
      subscriptionInterval: "monthly",
      now: new Date("2026-10-03T09:00:00.000Z"),
      month: "2026-09",
    });

    expect(window).toEqual({
      source: "calendar_month",
      startIso: "2026-08-31T18:30:00.000Z",
      endIso: "2026-09-30T18:30:00.000Z",
      month: "2026-09",
    });
  });
});

describe("listUsageMonthOptions", () => {
  it("lists the current IST month and the previous 11 months", () => {
    const options = listUsageMonthOptions(new Date("2026-10-03T09:00:00.000Z"));

    expect(options).toHaveLength(12);
    expect(options[0]).toEqual({
      value: "2026-10",
      label: "October 2026 (Current)",
      isCurrent: true,
    });
    expect(options[1]).toEqual({
      value: "2026-09",
      label: "September 2026",
      isCurrent: false,
    });
    expect(options[11]?.value).toBe("2025-11");
  });
});
