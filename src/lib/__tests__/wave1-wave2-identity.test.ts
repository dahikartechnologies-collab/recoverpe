import { describe, expect, it } from "vitest";
import { resolveLandingPath } from "@/lib/active-context";
import { isAgentReferralFrozen } from "@/lib/agent/cash-protocol";
import {
  AGENT_LIABILITY_FREEZE_INR,
  AGENT_MAX_OPEN_CASH_TICKETS,
} from "@/lib/agent/constants";
import {
  expectedPremiumInr,
  extractSixDigitOtp,
  hashAgentOtp,
  agentOtpMatches,
} from "@/lib/agent/otp";
import { buildRuleBasedBriefing } from "@/lib/briefing";
import { computeDebtorHealthScore } from "@/lib/debtor-health";

describe("resolveLandingPath", () => {
  it("sends dual-identity users to the chooser when no cookie is set", () => {
    expect(
      resolveLandingPath({
        surfaces: { has_merchant: true, has_agent: true },
        role: "owner",
        activeContext: null,
      })
    ).toBe("/choose-context");
  });

  it("honors an agent cookie for dual-identity users", () => {
    expect(
      resolveLandingPath({
        surfaces: { has_merchant: true, has_agent: true },
        role: "owner",
        activeContext: "agent",
      })
    ).toBe("/agent-dashboard");
  });

  it("routes field staff in merchant context to the kiosk", () => {
    expect(
      resolveLandingPath({
        surfaces: { has_merchant: true, has_agent: false },
        role: "field_staff",
        activeContext: "merchant",
      })
    ).toBe("/kiosk");
  });
});

describe("agent cash protocol helpers", () => {
  it("freezes at five unremitted Premium tickets", () => {
    expect(
      isAgentReferralFrozen({
        walletLiabilityInr: AGENT_LIABILITY_FREEZE_INR,
        openCashTickets: 4,
      })
    ).toBe(false);
    expect(
      isAgentReferralFrozen({
        walletLiabilityInr: AGENT_LIABILITY_FREEZE_INR + 1,
        openCashTickets: 1,
      })
    ).toBe(true);
    expect(
      isAgentReferralFrozen({
        walletLiabilityInr: 0,
        openCashTickets: AGENT_MAX_OPEN_CASH_TICKETS,
      })
    ).toBe(true);
  });

  it("hashes OTPs and prices Premium after discount bps", () => {
    const hash = hashAgentOtp("123456");
    expect(agentOtpMatches("123456", hash)).toBe(true);
    expect(agentOtpMatches("000000", hash)).toBe(false);
    expect(extractSixDigitOtp(" 847291 ")).toBe("847291");
    expect(extractSixDigitOtp("hello")).toBeNull();
    expect(expectedPremiumInr(1000)).toBe(1799.1);
  });
});

describe("debtor health score", () => {
  it("scores a fast payer with kept promises near the top", () => {
    expect(
      computeDebtorHealthScore({
        medianDaysToPay: 0,
        keptPromises: 4,
        brokenPromises: 0,
        rejectedProofs90d: 0,
        medianReplyHours: 1,
        avgDaysPastDue: 0,
      })
    ).toBe(100);
  });

  it("uses the spec neutrals when there is no history", () => {
    expect(
      computeDebtorHealthScore({
        medianDaysToPay: null,
        keptPromises: 0,
        brokenPromises: 0,
        rejectedProofs90d: 0,
        medianReplyHours: null,
        avgDaysPastDue: 0,
      })
    ).toBe(57);
  });
});

describe("morning briefing fallback", () => {
  it("writes a quiet-night headline when nothing moved", () => {
    const briefing = buildRuleBasedBriefing(
      {
        collected_inr: 0,
        proofs_pending: 0,
        promises_broken: 0,
        whatsapp_failed: 0,
      },
      "2026-09-16"
    );

    expect(briefing.headline).toContain("Quiet night");
    expect(briefing.model).toBe("rule-based");
  });
});
