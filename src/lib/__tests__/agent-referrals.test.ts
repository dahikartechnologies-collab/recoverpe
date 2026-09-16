import { describe, expect, it } from "vitest";
import { updateAgentReferralQuote } from "@/lib/agent/referrals";

describe("updateAgentReferralQuote", () => {
  it("rejects edits once cash is held", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "ref-1",
                  status: "cash_held",
                  discount_bps: 500,
                  business_name: "Shop",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    await expect(
      updateAgentReferralQuote(
        supabase as never,
        "agent-1",
        "ref-1",
        { discountBps: 1000 },
        1200
      )
    ).rejects.toThrow("Only draft or awaiting OTP referrals can be edited.");
  });
});
