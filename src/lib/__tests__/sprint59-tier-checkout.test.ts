import { describe, expect, it } from "vitest";
import {
  hasEntitlement,
  resolveEffectiveTier,
} from "@/lib/entitlements";
import {
  buildPaymentReference,
  resolveSmartCheckout,
  ZERO_MDR_THRESHOLD_INR,
} from "@/lib/payments/smart-checkout-router";

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
      hasEntitlement({ subscription_tier: "free" }, "team_management")
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
