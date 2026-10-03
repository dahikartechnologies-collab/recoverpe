import { describe, expect, it } from "vitest";
import {
  applyLiveUsageCounts,
  buildUsageDashboardPayload,
  EMPTY_LIVE_BUSINESS_USAGE,
  EMPTY_USAGE_TABLE_COUNTS,
  toUsageTableCounts,
  type BusinessUsageMeteringRow,
} from "@/lib/business-usage-metering";
import {
  parseMerchantBankAccountType,
  shouldMarkAccountPrimary,
} from "@/lib/payments/merchant-bank-account-type";

function meteringRow(): BusinessUsageMeteringRow {
  return {
    id: "biz-1",
    subscription_tier: "starter",
    quota_smart_collect: 0,
    usage_smart_collect: 0,
    quota_sms: 0,
    usage_sms: 0,
    quota_whatsapp: 500,
    usage_whatsapp: 0,
    quota_vapi_minutes: 0,
    usage_vapi_minutes: 0,
    quota_invoices: 99_999,
    usage_invoices: 0,
    pass_through_overages: false,
    total_volume_collected_inr: 0,
    total_gateway_fees_inr: 0,
  };
}

describe("usage live counts", () => {
  it("maps empty live usage onto zero table counts", () => {
    expect(toUsageTableCounts(EMPTY_LIVE_BUSINESS_USAGE)).toEqual(
      EMPTY_USAGE_TABLE_COUNTS
    );
  });

  it("builds a usage payload with zero live counts when a business has no rows", () => {
    const payload = buildUsageDashboardPayload(
      applyLiveUsageCounts(meteringRow(), EMPTY_LIVE_BUSINESS_USAGE),
      { live_counts: { ...EMPTY_USAGE_TABLE_COUNTS } }
    );

    expect(payload.live_counts).toEqual({
      ledgers: 0,
      communications: 0,
      inbound_payments: 0,
      stock_movements: 0,
      whatsapp: 0,
      sms: 0,
    });
    expect(payload.metrics.every((metric) => metric.usage === 0)).toBe(true);
    expect(payload.usage_window).toEqual({
      source: "all_time",
      startIso: null,
      endIso: null,
    });
  });
});

describe("merchant bank account type", () => {
  it("defaults unknown values to business", () => {
    expect(parseMerchantBankAccountType(undefined)).toBe("business");
    expect(parseMerchantBankAccountType("personal")).toBe("personal");
  });

  it("marks only the first verified account as primary", () => {
    expect(shouldMarkAccountPrimary(0)).toBe(true);
    expect(shouldMarkAccountPrimary(1)).toBe(false);
  });
});
