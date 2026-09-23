import { describe, expect, it } from "vitest";
import {
  getSubscriptionPlanAmountPaise,
  getSubscriptionPlanPeriod,
  planMatchesSubscriptionPurchase,
} from "@/lib/payments/razorpay-plan-resolver";

describe("razorpay plan resolver", () => {
  it("maps annual subscriptions to yearly Razorpay periods", () => {
    expect(getSubscriptionPlanPeriod("subscription_starter_annual")).toBe(
      "yearly"
    );
    expect(getSubscriptionPlanPeriod("subscription_business_monthly")).toBe(
      "monthly"
    );
  });

  it("uses the discounted premium amount when eligible", () => {
    expect(
      getSubscriptionPlanAmountPaise("subscription_premium", true)
    ).toBe(99_950);
    expect(
      getSubscriptionPlanAmountPaise("subscription_premium", false)
    ).toBe(199_900);
  });

  it("matches plans by amount, period, and purchase type note", () => {
    const plan = {
      id: "plan_starter_monthly",
      period: "monthly",
      interval: 1,
      item: {
        amount: 49_900,
        currency: "INR",
      },
      notes: {
        recoverpe_purchase_type: "subscription_starter_monthly",
      },
    };

    expect(
      planMatchesSubscriptionPurchase(
        plan,
        "subscription_starter_monthly",
        49_900,
        "monthly"
      )
    ).toBe(true);
    expect(
      planMatchesSubscriptionPurchase(
        plan,
        "subscription_business_monthly",
        49_900,
        "monthly"
      )
    ).toBe(false);
  });
});
