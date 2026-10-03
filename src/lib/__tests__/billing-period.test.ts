import { describe, expect, it } from "vitest";
import { resolveCurrentBillingPeriod } from "@/lib/billing-period";

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
