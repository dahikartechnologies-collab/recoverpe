import { describe, expect, it } from "vitest";
import {
  FREE_OPEN_PROMISES,
  hasSettlementDeskQuotaRemaining,
  isBusinessAddonActive,
  normalizedProofQuotaUsed,
  parseBusinessAddons,
  shouldResetProofQuota,
} from "@/lib/business-addons";
import { FREE_PLAN_LEDGER_LIMIT } from "@/lib/razorpay-products";
import {
  parsePaymentPromiseExtraction,
} from "@/lib/promise-register";

describe("business add-ons metering", () => {
  it("treats expired add-ons as inactive", () => {
    const addons = parseBusinessAddons({
      settlement_desk_monthly: {
        active: true,
        activated_at: "2026-01-01T00:00:00.000Z",
        expires_at: "2026-01-02T00:00:00.000Z",
      },
    });

    expect(
      isBusinessAddonActive(addons, "settlement_desk_monthly", new Date("2026-01-03T00:00:00.000Z"))
    ).toBe(false);
  });

  it("resets proof quota at the start of a new IST month", () => {
    expect(shouldResetProofQuota("2026-08-01", "2026-09-16")).toBe(true);
    expect(
      normalizedProofQuotaUsed(
        { proof_quota_used_month: 15, proof_quota_reset_on: "2026-09-01" },
        "2026-09-16"
      )
    ).toBe(15);
    expect(
      normalizedProofQuotaUsed(
        { proof_quota_used_month: 15, proof_quota_reset_on: "2026-08-01" },
        "2026-09-16"
      )
    ).toBe(0);
  });

  it("blocks free-tier proof processing after fifteen scans", () => {
    expect(
      hasSettlementDeskQuotaRemaining(
        {
          id: "biz-1",
          addons: {},
          proof_quota_used_month: FREE_PLAN_LEDGER_LIMIT,
          proof_quota_reset_on: "2026-09-01",
        },
        "2026-09-16"
      )
    ).toBe(false);
  });

  it("documents the free open-promise cap", () => {
    expect(FREE_OPEN_PROMISES).toBe(5);
  });
});

describe("promise extraction parser", () => {
  it("parses fenced JSON with promised date and amount", () => {
    const parsed = parsePaymentPromiseExtraction(`
\`\`\`json
{"has_promise": true, "promised_date": "2026-09-19", "promised_amount": 4500}
\`\`\`
`);

    expect(parsed).toEqual({
      has_promise: true,
      promised_date: "2026-09-19",
      promised_amount: 4500,
    });
  });

  it("returns null for invalid payloads", () => {
    expect(parsePaymentPromiseExtraction("not json")).toBeNull();
  });
});
