import { describe, expect, it } from "vitest";
import {
  buildBusinessPulse,
  buildFallbackNarrative,
  parseInsightNarrative,
} from "@/lib/business-pulse";

describe("buildBusinessPulse", () => {
  it("flags a cash shortfall when expenses beat collections", () => {
    const pulse = buildBusinessPulse({
      collectedThisMonth: 10000,
      totalOutstanding: 50000,
      activeDefaulters: 4,
      collectionRate: 40,
      aging61Plus: 20000,
      spentThisMonth: 18000,
      topExpenseCategory: "Raw Material",
      topExpenseCategoryAmount: 12000,
    });

    expect(pulse.netCashflow).toBe(-8000);
    expect(pulse.headline).toMatch(/Spending is running ahead/i);
    expect(pulse.bullets[0]?.detail).toContain("Shortfall");
    expect(pulse.bullets.some((bullet) => bullet.label === "Stuck money")).toBe(
      true
    );
  });

  it("celebrates a healthy collection rate when cash is positive", () => {
    const pulse = buildBusinessPulse({
      collectedThisMonth: 80000,
      totalOutstanding: 12000,
      activeDefaulters: 1,
      collectionRate: 82,
      aging61Plus: 0,
      spentThisMonth: 15000,
      topExpenseCategory: null,
      topExpenseCategoryAmount: 0,
    });

    expect(pulse.netCashflow).toBe(65000);
    expect(pulse.headline).toMatch(/Collections are holding/i);
  });
});

describe("parseInsightNarrative", () => {
  it("accepts fenced JSON and trims lists", () => {
    const narrative = parseInsightNarrative(`\`\`\`json
{"headline":"Chase old dues","bullets":["A","B"],"actions":["Call the oldest account"]}
\`\`\``);

    expect(narrative).toEqual({
      headline: "Chase old dues",
      bullets: ["A", "B"],
      actions: ["Call the oldest account"],
    });
  });

  it("rejects a payload with no headline", () => {
    expect(parseInsightNarrative(`{"bullets":["A"]}`)).toBeNull();
  });
});

describe("buildFallbackNarrative", () => {
  it("turns pulse bullets into a premium-shaped briefing", () => {
    const pulse = buildBusinessPulse({
      collectedThisMonth: 1000,
      totalOutstanding: 5000,
      activeDefaulters: 2,
      collectionRate: 20,
      aging61Plus: 3000,
      spentThisMonth: 0,
      topExpenseCategory: null,
      topExpenseCategoryAmount: 0,
    });
    const narrative = buildFallbackNarrative(pulse);

    expect(narrative.headline).toBe(pulse.headline);
    expect(narrative.bullets.length).toBeGreaterThan(0);
    expect(narrative.actions.length).toBeGreaterThan(0);
  });
});
