import { describe, expect, it } from "vitest";
import { resolveCurrentBillingPeriod, resolveUsageCountWindow } from "@/lib/billing-period";

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
    });
  });

  it("counts all workspace activity when there is no active subscription period", () => {
    const window = resolveUsageCountWindow({
      now: new Date("2026-10-03T09:00:00.000Z"),
    });

    expect(window).toEqual({
      source: "all_time",
      startIso: null,
      endIso: null,
    });
  });
});
