import { formatCurrency } from "@/lib/gst";

export interface BusinessPulseInput {
  collectedThisMonth: number;
  totalOutstanding: number;
  activeDefaulters: number;
  collectionRate: number;
  aging61Plus: number;
  spentThisMonth: number;
  topExpenseCategory: string | null;
  topExpenseCategoryAmount: number;
}

export interface BusinessPulseBullet {
  label: string;
  detail: string;
}

export interface BusinessPulse {
  headline: string;
  netCashflow: number;
  bullets: BusinessPulseBullet[];
}

export interface InsightNarrative {
  headline: string;
  bullets: string[];
  actions: string[];
}

function round0(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Rule-based briefing from numbers already on the dashboard. Free users get
 * this instantly with no LLM call. Premium users see the same numbers plus a
 * Gemini narrative generated from this payload — never from raw ledgers.
 */
export function buildBusinessPulse(input: BusinessPulseInput): BusinessPulse {
  const netCashflow = round0(input.collectedThisMonth - input.spentThisMonth);
  const bullets: BusinessPulseBullet[] = [];

  if (netCashflow >= 0) {
    bullets.push({
      label: "Cash this month",
      detail: `Collected ${formatCurrency(input.collectedThisMonth)} against ${formatCurrency(input.spentThisMonth)} of expenses. Net ${formatCurrency(netCashflow)} in.`,
    });
  } else {
    bullets.push({
      label: "Cash this month",
      detail: `Expenses of ${formatCurrency(input.spentThisMonth)} outran collections of ${formatCurrency(input.collectedThisMonth)}. Shortfall ${formatCurrency(Math.abs(netCashflow))}.`,
    });
  }

  bullets.push({
    label: "Still owed",
    detail:
      input.activeDefaulters === 0
        ? `No open defaulters. Outstanding is ${formatCurrency(input.totalOutstanding)}.`
        : `${input.activeDefaulters} open ${input.activeDefaulters === 1 ? "account" : "accounts"} still owe ${formatCurrency(input.totalOutstanding)}. Collection rate ${input.collectionRate}%.`,
  });

  if (input.aging61Plus > 0) {
    bullets.push({
      label: "Stuck money",
      detail: `${formatCurrency(input.aging61Plus)} has been overdue for more than 61 days. That is the first place to chase.`,
    });
  } else if (input.totalOutstanding > 0) {
    bullets.push({
      label: "Aging",
      detail: "Nothing is older than 61 days. Stay on the current cycle before it slips.",
    });
  }

  if (input.topExpenseCategory && input.topExpenseCategoryAmount > 0) {
    bullets.push({
      label: "Biggest spend",
      detail: `${input.topExpenseCategory} is ${formatCurrency(input.topExpenseCategoryAmount)} this month.`,
    });
  }

  const headline =
    netCashflow < 0
      ? "Spending is running ahead of collections this month."
      : input.aging61Plus > input.collectedThisMonth && input.aging61Plus > 0
        ? "Old dues are larger than what you collected this month."
        : input.collectionRate >= 70
          ? "Collections are holding. Keep the cadence going."
          : "Collections need attention this week.";

  return { headline, netCashflow, bullets: bullets.slice(0, 4) };
}

export function parseInsightNarrative(raw: string): InsightNarrative | null {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as {
      headline?: unknown;
      bullets?: unknown;
      actions?: unknown;
    };

    const headline =
      typeof parsed.headline === "string" ? parsed.headline.trim() : "";
    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    if (!headline || bullets.length === 0) {
      return null;
    }

    return { headline, bullets, actions };
  } catch {
    return null;
  }
}

/** Used in development and as a Vertex fallback so Premium never shows an empty card. */
export function buildFallbackNarrative(pulse: BusinessPulse): InsightNarrative {
  return {
    headline: pulse.headline,
    bullets: pulse.bullets.map((bullet) => `${bullet.label}: ${bullet.detail}`),
    actions:
      pulse.netCashflow < 0
        ? [
            "Chase the oldest unpaid invoices today.",
            "Hold non-urgent expenses until collections catch up.",
          ]
        : [
            "Send reminders on every invoice older than 30 days.",
            "Record this week's expenses so the cash picture stays true.",
          ],
  };
}

export function buildInsightsPrompt(pulse: BusinessPulse): string {
  return `You are RecoverPe's CFO copilot for an Indian MSME. Write a briefing from these numbers only. Do not invent names, phone numbers, UTRs, or invoices.

Numbers:
${JSON.stringify(pulse)}

Return JSON only:
{
  "headline": "one sentence, plain language, no hype",
  "bullets": ["3 to 5 observations a shop owner can act on"],
  "actions": ["2 or 3 concrete next steps for this week"]
}

Rules: amounts stay in Indian rupees as already formatted. Never promise legal outcomes. Never ask for more personal data.`;
}
