import { describe, expect, it } from "vitest";
import {
  summarizeAgentDiscountStats,
} from "@/lib/agent/analytics";

describe("summarizeAgentDiscountStats", () => {
  it("only counts discounts on closed sales, not draft pipeline rows", () => {
    const stats = summarizeAgentDiscountStats({
      discountCapBps: 1000,
      listPriceInr: 1999,
      referrals: [
        { discount_bps: 1200, status: "draft" },
        { discount_bps: 1000, status: "awaiting_merchant_otp" },
        { discount_bps: 1000, status: "activated" },
        { discount_bps: 500, status: "cash_held" },
        { discount_bps: 1200, status: "cancelled" },
      ],
    });

    expect(stats.total_discounts_granted_inr).toBe(299.85);
    expect(stats.average_discount_percent).toBe(7.5);
    expect(stats.cap_remaining_bps).toBe(0);
    expect(stats.quota_used_bps).toBe(1000);
    expect(stats.monthly_cap_bps).toBe(1000);
    expect(stats.average_deal_roi_percent).toBeGreaterThan(0);
  });

  it("returns zero discount stats when there are no closed sales", () => {
    const stats = summarizeAgentDiscountStats({
      discountCapBps: 1000,
      referrals: [{ discount_bps: 1000, status: "awaiting_merchant_otp" }],
    });

    expect(stats.total_discounts_granted_inr).toBe(0);
    expect(stats.average_discount_percent).toBe(0);
    expect(stats.cap_remaining_bps).toBe(0);
    expect(stats.quota_used_bps).toBe(1000);
    expect(stats.average_deal_roi_percent).toBe(0);
  });
});
