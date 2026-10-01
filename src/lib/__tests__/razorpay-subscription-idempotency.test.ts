import { describe, expect, it } from "vitest";
import { shouldSkipDuplicateSubscriptionFulfillment } from "@/lib/razorpay-subscription-idempotency";

describe("shouldSkipDuplicateSubscriptionFulfillment", () => {
  const periodEnd = new Date("2026-11-01T00:00:00.000Z");

  it("re-grants when the subscription is not yet active", () => {
    expect(
      shouldSkipDuplicateSubscriptionFulfillment({
        event: "subscription.activated",
        storedStatus: "created",
        storedPeriodEnd: null,
        incomingPeriodEnd: periodEnd,
      })
    ).toBe(false);
  });

  it("skips activation retries once the subscription is already active", () => {
    expect(
      shouldSkipDuplicateSubscriptionFulfillment({
        event: "subscription.activated",
        storedStatus: "active",
        storedPeriodEnd: periodEnd.toISOString(),
        incomingPeriodEnd: periodEnd,
      })
    ).toBe(true);
  });

  it("skips a charged replay for the same billing period", () => {
    expect(
      shouldSkipDuplicateSubscriptionFulfillment({
        event: "subscription.charged",
        storedStatus: "active",
        storedPeriodEnd: periodEnd.toISOString(),
        incomingPeriodEnd: periodEnd,
      })
    ).toBe(true);
  });

  it("applies a later charged period so renewals still extend entitlements", () => {
    expect(
      shouldSkipDuplicateSubscriptionFulfillment({
        event: "subscription.charged",
        storedStatus: "active",
        storedPeriodEnd: periodEnd.toISOString(),
        incomingPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
      })
    ).toBe(false);
  });
});
