import { describe, expect, it } from "vitest";
import {
  AGENT_DISCOUNT_OPTIONS,
  formatExpectedCashCollection,
  getAgentDiscountOptionsForCap,
  isAllowedAgentDiscountBps,
} from "@/lib/agent/discounts";

describe("agent discount options", () => {
  it("only allows fixed percentage tiers within the agent cap", () => {
    expect(getAgentDiscountOptionsForCap(1200)).toEqual(AGENT_DISCOUNT_OPTIONS);
    expect(getAgentDiscountOptionsForCap(1000)).toEqual(
      AGENT_DISCOUNT_OPTIONS.filter((option) => option.bps <= 1000)
    );
    expect(isAllowedAgentDiscountBps(1200, 1200)).toBe(true);
    expect(isAllowedAgentDiscountBps(1200, 1000)).toBe(false);
    expect(isAllowedAgentDiscountBps(200, 1200)).toBe(false);
  });

  it("calculates expected cash from list price and discount bps", () => {
    expect(formatExpectedCashCollection(0)).toBe("₹1,999");
    expect(formatExpectedCashCollection(1000)).toBe("₹1,799.10");
    expect(formatExpectedCashCollection(1200)).toBe("₹1,759.12");
  });
});
