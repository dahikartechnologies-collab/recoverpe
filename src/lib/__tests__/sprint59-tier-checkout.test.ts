import { describe, expect, it } from "vitest";
import {
  getEffectiveVapiMinutesQuota,
  hasEntitlement,
  resolveEffectiveTier,
} from "@/lib/entitlements";
import {
  buildPaymentReference,
  resolveSmartCheckout,
  ZERO_MDR_THRESHOLD_INR,
} from "@/lib/payments/smart-checkout-router";
import {
  calculateVapiCallBill,
  splitVapiBillAcrossTrialAndWallet,
  VAPI_CUSTOMER_RATE_PER_MINUTE_INR,
} from "@/lib/vapi-pricing";

describe("entitlements", () => {
  it("grants business features on business tier", () => {
    expect(
      hasEntitlement({ subscription_tier: "business" }, "zero_mdr_checkout")
    ).toBe(true);
    expect(
      hasEntitlement({ subscription_tier: "business" }, "team_management")
    ).toBe(true);
    expect(
      hasEntitlement({ subscription_tier: "starter" }, "zero_mdr_checkout")
    ).toBe(false);
    expect(
      hasEntitlement({ subscription_tier: "premium" }, "ai_voice_calls")
    ).toBe(true);
    expect(
      hasEntitlement({ subscription_tier: "business" }, "ai_voice_calls")
    ).toBe(false);
  });

  it("only bundles a 10-minute premium AI trial, not flat SaaS minutes", () => {
    expect(getEffectiveVapiMinutesQuota("starter")).toBe(0);
    expect(getEffectiveVapiMinutesQuota("business")).toBe(0);
    expect(getEffectiveVapiMinutesQuota("premium")).toBe(10);
  });

  it("restores active Razorpay tier after an expired admin grant", () => {
    expect(
      resolveEffectiveTier({
        subscription_tier: "premium",
        subscription_expires_at: "2020-01-01T00:00:00.000Z",
        razorpay_subscription_id: "sub_live_123",
        subscription_status: "active",
        subscription_billing_tier: "business",
      })
    ).toBe("premium");
  });

  it("falls back to stored billing tier when admin grant expires without live Razorpay", () => {
    expect(
      resolveEffectiveTier({
        subscription_tier: "premium",
        subscription_expires_at: "2020-01-01T00:00:00.000Z",
        razorpay_subscription_id: "admin_granted",
        subscription_status: "active",
        subscription_billing_tier: "business",
      })
    ).toBe("business");
  });

  it("degrades to starter when no paid subscription remains", () => {
    expect(
      resolveEffectiveTier({
        subscription_tier: "premium",
        subscription_expires_at: "2020-01-01T00:00:00.000Z",
        razorpay_subscription_id: "admin_granted",
        subscription_status: "active",
      })
    ).toBe("starter");
    expect(
      hasEntitlement(
        {
          subscription_tier: "premium",
          subscription_expires_at: "2020-01-01T00:00:00.000Z",
          razorpay_subscription_id: "admin_granted",
        },
        "ai_voice_calls"
      )
    ).toBe(false);
  });

  it("grandfathers legacy add-ons to business", () => {
    expect(
      resolveEffectiveTier({
        subscription_tier: "free",
        addons: {
          settlement_desk_monthly: {
            active: true,
            activated_at: "2026-01-01T00:00:00.000Z",
            expires_at: "2099-01-01T00:00:00.000Z",
          },
        },
      })
    ).toBe("business");
  });
});

describe("vapi pricing", () => {
  it("charges a 30% margin over the ₹20/min provider cost", () => {
    const bill = calculateVapiCallBill(60);

    expect(bill.customer_charge_inr).toBe(VAPI_CUSTOMER_RATE_PER_MINUTE_INR);
    expect(bill.provider_cost_inr).toBe(20);
    expect(bill.margin_inr).toBe(6);
  });

  it("applies premium trial minutes before wallet billing", () => {
    const bill = calculateVapiCallBill(120);
    const split = splitVapiBillAcrossTrialAndWallet(bill, 10);

    expect(split.trial_minutes_applied).toBe(2);
    expect(split.wallet_charge_inr).toBe(0);
  });
});

describe("smart checkout router", () => {
  it("uses UPI for small amounts", () => {
    const decision = resolveSmartCheckout({
      amount: ZERO_MDR_THRESHOLD_INR,
      ledgerId: "11111111-1111-1111-1111-111111111111",
      invoiceNumber: "INV-1",
      business: { subscription_tier: "business" },
      businessName: "Acme",
      merchantVpa: "merchant@upi",
      virtualBankAccountNumber: "1234567890",
      virtualIfscCode: "RAZR0000000",
    });

    expect(decision.mode).toBe("upi_standard");
    expect(decision.upi?.vpa).toBe("merchant@upi");
  });

  it("uses bank rail for business tier above threshold", () => {
    const ledgerId = "22222222-2222-2222-2222-222222222222";
    const decision = resolveSmartCheckout({
      amount: ZERO_MDR_THRESHOLD_INR + 1,
      ledgerId,
      invoiceNumber: "INV-99",
      business: { subscription_tier: "business" },
      businessName: "Acme",
      merchantVpa: "merchant@upi",
      virtualBankAccountNumber: "1234567890",
      virtualIfscCode: "RAZR0000000",
    });

    expect(decision.mode).toBe("zero_mdr_bank");
    expect(decision.bank?.accountNumber).toBe("1234567890");
    expect(decision.paymentReference).toBe(buildPaymentReference(ledgerId, "INV-99"));
  });
});
