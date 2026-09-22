import { describe, expect, it } from "vitest";
import {
  shouldApplyFreeInvoiceLimits,
  shouldShowRecoverpeBranding,
} from "@/lib/tier-fulfillment";

describe("tier fulfillment invoice policy", () => {
  it("caps free-tier businesses at invoice limits with branding", () => {
    expect(
      shouldApplyFreeInvoiceLimits({
        subscription_tier: "free",
        subscription_status: "none",
      })
    ).toBe(true);
    expect(
      shouldShowRecoverpeBranding({
        subscription_tier: "free",
        subscription_status: "none",
      })
    ).toBe(true);
  });

  it("removes invoice limits and branding for active paid starter", () => {
    expect(
      shouldApplyFreeInvoiceLimits({
        subscription_tier: "starter",
        subscription_status: "active",
        subscription_expires_at: "2099-01-01T00:00:00.000Z",
      })
    ).toBe(false);
    expect(
      shouldShowRecoverpeBranding({
        subscription_tier: "starter",
        subscription_status: "active",
        subscription_expires_at: "2099-01-01T00:00:00.000Z",
      })
    ).toBe(false);
  });

  it("removes invoice limits and branding for business and premium tiers", () => {
    expect(
      shouldApplyFreeInvoiceLimits({
        subscription_tier: "business",
        subscription_status: "active",
      })
    ).toBe(false);
    expect(
      shouldApplyFreeInvoiceLimits({
        subscription_tier: "premium",
        subscription_status: "active",
      })
    ).toBe(false);
  });

  it("treats unpaid starter defaults as free-tier invoice limits", () => {
    expect(
      shouldApplyFreeInvoiceLimits({
        subscription_tier: "starter",
        subscription_status: "none",
      })
    ).toBe(true);
  });
});
