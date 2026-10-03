import { describe, expect, it } from "vitest";
import {
  applyLiveUsageCounts,
  buildUsageDashboardPayload,
  BusinessUsageMeteringRow,
} from "@/lib/business-usage-metering";
import { parseDashboardAnalyticsRpc } from "@/lib/dashboard-analytics";

function meteringRow(
  overrides: Partial<BusinessUsageMeteringRow> = {}
): BusinessUsageMeteringRow {
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
    ...overrides,
  };
}

describe("applyLiveUsageCounts", () => {
  it("replaces denormalized zeros with live billing-period counts", () => {
    const hydrated = applyLiveUsageCounts(meteringRow(), {
      invoices: 12,
      whatsapp: 48,
      sms: 3,
      smartCollect: 7,
      vapiMinutes: 4,
      stockMovements: 21,
    });

    const payload = buildUsageDashboardPayload(hydrated);
    const byKey = Object.fromEntries(
      payload.metrics.map((metric) => [metric.key, metric.usage])
    );

    expect(byKey.invoices).toBe(12);
    expect(byKey.whatsapp).toBe(48);
    expect(byKey.sms).toBe(3);
    expect(byKey.smart_collect).toBe(7);
  });

  it("maps metric cards from live_counts even when usage_* columns are zero", () => {
    const payload = buildUsageDashboardPayload(meteringRow(), {
      live_counts: {
        ledgers: 12,
        communications: 51,
        inbound_payments: 7,
        stock_movements: 21,
        whatsapp: 48,
        sms: 3,
      },
    });
    const byKey = Object.fromEntries(
      payload.metrics.map((metric) => [metric.key, metric.usage])
    );

    expect(byKey.invoices).toBe(12);
    expect(byKey.whatsapp).toBe(48);
    expect(byKey.sms).toBe(3);
    expect(byKey.smart_collect).toBe(7);
  });
});

describe("parseDashboardAnalyticsRpc", () => {
  it("maps Postgres aggregates onto dashboard metric cards", () => {
    const analytics = parseDashboardAnalyticsRpc(
      {
        total_outstanding: "150000",
        collected_this_month: "40000",
        active_defaulters: "6",
        expected_this_month: "80000",
        collected_previous_month: "20000",
        expected_previous_month: "50000",
        aging: { "0-30": 10000, "31-60": 20000, "61+": 120000 },
        cash_flow: [
          { month_key: "2026-10", expected: 80000, collected: 40000 },
        ],
        sankey: {
          collected_on_time: 25000,
          bucket_0_30: 10000,
          bucket_31_60: 20000,
          bucket_60_plus: 120000,
          legal_samadhaan: 40000,
          unrecovered: 80000,
        },
      },
      new Date("2026-10-03T09:00:00.000Z")
    );

    expect(analytics.summary.totalOutstanding).toBe(150000);
    expect(analytics.summary.collectedThisMonth).toBe(40000);
    expect(analytics.summary.activeDefaulters).toBe(6);
    expect(analytics.summary.collectionRate).toBe(50);
    expect(analytics.aging[2]?.amount).toBe(120000);
    expect(analytics.sankey.links.length).toBeGreaterThan(0);
  });
});
