import { describe, expect, it } from "vitest";
import {
  getEffectiveVapiMinutesQuota,
  hasEntitlement,
  PREMIUM_VAPI_TRIAL_MINUTES,
  resolveEffectiveTier,
} from "@/lib/entitlements";
import {
  buildPaymentReference,
  resolveSmartCheckout,
  ZERO_MDR_THRESHOLD_INR,
} from "@/lib/payments/smart-checkout-router";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-settings";
import {
  calculateVapiBillFromProviderCost,
  calculateWalletRechargeBreakdown,
  splitVapiBillAcrossTrialAndWallet,
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
    expect(
      hasEntitlement({ subscription_tier: "free" }, "whatsapp_reminders")
    ).toBe(false);
    expect(
      hasEntitlement(
        {
          subscription_tier: "starter",
          subscription_status: "active",
        },
        "whatsapp_reminders"
      )
    ).toBe(true);
  });

  it("only bundles a premium AI trial, not flat SaaS minutes", () => {
    expect(getEffectiveVapiMinutesQuota("starter")).toBe(0);
    expect(getEffectiveVapiMinutesQuota("business")).toBe(0);
    expect(getEffectiveVapiMinutesQuota("premium")).toBe(PREMIUM_VAPI_TRIAL_MINUTES);
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
  it("applies FX buffer and margin from platform settings", () => {
    const bill = calculateVapiBillFromProviderCost(0.25, 90, {
      settings: DEFAULT_PLATFORM_SETTINGS,
      liveUsdToInr: 86,
    });

    expect(bill.vapi_cost_usd).toBe(0.25);
    expect(bill.live_usd_to_inr).toBe(86);
    expect(bill.applied_fx_rate).toBe(87.72);
    expect(bill.applied_margin_pct).toBe(30);
    expect(bill.provider_cost_inr).toBe(21.93);
    expect(bill.customer_charge_inr).toBe(28.51);
    expect(bill.margin_inr).toBe(6.58);
  });

  it("calculates wallet recharge GST on the base credit amount", () => {
    const breakdown = calculateWalletRechargeBreakdown(1000);

    expect(breakdown.base_amount_inr).toBe(1000);
    expect(breakdown.gst_amount_inr).toBe(180);
    expect(breakdown.total_payable_inr).toBe(1180);
  });

  it("applies premium trial minutes before wallet billing", () => {
    const bill = calculateVapiBillFromProviderCost(0.2, 120, {
      settings: DEFAULT_PLATFORM_SETTINGS,
      liveUsdToInr: 86,
    });
    const split = splitVapiBillAcrossTrialAndWallet(bill, 10);

    expect(split.trial_minutes_applied).toBe(2);
    expect(split.wallet_charge_inr).toBe(0);
    expect(bill.customer_charge_inr).toBe(22.8);
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
