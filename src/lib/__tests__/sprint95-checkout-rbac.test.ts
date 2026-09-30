import { describe, expect, it } from "vitest";
import { hasCollectionDetails } from "@/lib/collection-details";
import { resolveHardcodedSubscriptionPlanId } from "@/lib/razorpay-products";

describe("sprint 95 collection gate", () => {
  it("accepts either a UPI VPA or a payout bank account", () => {
    expect(
      hasCollectionDetails({
        defaultUpiVpa: "shop@upi",
        payoutBankAccountNumber: null,
      })
    ).toBe(true);
    expect(
      hasCollectionDetails({
        defaultUpiVpa: "  ",
        payoutBankAccountNumber: "1234567890",
      })
    ).toBe(true);
    expect(
      hasCollectionDetails({
        defaultUpiVpa: null,
        payoutBankAccountNumber: null,
      })
    ).toBe(false);
  });
});

describe("hardcoded razorpay plans", () => {
  it("reads the starter monthly plan from its own env var", () => {
    const previous = process.env.RAZORPAY_PLAN_STARTER_MONTHLY;
    process.env.RAZORPAY_PLAN_STARTER_MONTHLY = "plan_starter_monthly";

    expect(
      resolveHardcodedSubscriptionPlanId("starter", "monthly", false)
    ).toEqual({
      planId: "plan_starter_monthly",
      envVar: "RAZORPAY_PLAN_STARTER_MONTHLY",
    });

    process.env.RAZORPAY_PLAN_STARTER_MONTHLY = previous;
  });
});
