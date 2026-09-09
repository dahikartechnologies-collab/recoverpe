export type VapiSentimentBadge = "cooperative" | "evasive" | "hostile";

export interface VapiCallInsights {
  sentiment: VapiSentimentBadge;
  sentiment_label: string;
  executive_summary: string;
}

const COOPERATIVE_KEYWORDS = [
  "pay",
  "payment",
  "will pay",
  "promise",
  "thank",
  "sorry",
  "apolog",
  "tomorrow",
  "today",
  "transfer",
  "settle",
];

const HOSTILE_KEYWORDS = [
  "refuse",
  "won't pay",
  "will not pay",
  "legal",
  "lawyer",
  "court",
  "harass",
  "stop calling",
  "don't call",
  "angry",
  "shut up",
  "idiot",
];

const EVASIVE_KEYWORDS = [
  "maybe",
  "not sure",
  "don't know",
  "later",
  "busy",
  "call back",
  "no money",
  "can't talk",
  "who is this",
];

export function sentimentEmoji(sentiment: VapiSentimentBadge): string {
  switch (sentiment) {
    case "cooperative":
      return "🟢";
    case "evasive":
      return "🟡";
    case "hostile":
      return "🔴";
  }
}

export function sentimentLabel(sentiment: VapiSentimentBadge): string {
  switch (sentiment) {
    case "cooperative":
      return "Cooperative";
    case "evasive":
      return "Evasive";
    case "hostile":
      return "Hostile / Flight Risk";
  }
}

function countKeywordHits(text: string, keywords: string[]): number {
  const normalized = text.toLowerCase();
  return keywords.reduce(
    (count, keyword) => (normalized.includes(keyword) ? count + 1 : count),
    0
  );
}

export function analyzeVapiTranscript(
  transcript: string,
  fallbackSummary?: string | null
): VapiCallInsights {
  const trimmedTranscript = transcript.trim();
  const cooperativeHits = countKeywordHits(trimmedTranscript, COOPERATIVE_KEYWORDS);
  const hostileHits = countKeywordHits(trimmedTranscript, HOSTILE_KEYWORDS);
  const evasiveHits = countKeywordHits(trimmedTranscript, EVASIVE_KEYWORDS);

  let sentiment: VapiSentimentBadge = "cooperative";

  if (hostileHits >= cooperativeHits && hostileHits > 0) {
    sentiment = "hostile";
  } else if (evasiveHits > cooperativeHits && evasiveHits > 0) {
    sentiment = "evasive";
  } else if (hostileHits > 0 && hostileHits === evasiveHits) {
    sentiment = "hostile";
  }

  const executive_summary = buildExecutiveSummary(
    trimmedTranscript,
    sentiment,
    fallbackSummary
  );

  return {
    sentiment,
    sentiment_label: sentimentLabel(sentiment),
    executive_summary,
  };
}

function buildExecutiveSummary(
  transcript: string,
  sentiment: VapiSentimentBadge,
  fallbackSummary?: string | null
): string {
  if (fallbackSummary?.trim()) {
    const sentences = fallbackSummary
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .slice(0, 2);

    if (sentences.length > 0) {
      return sentences.join(" ");
    }
  }

  const cleaned = transcript.replace(/\s+/g, " ").trim();
  const snippet = cleaned.slice(0, 220);

  const sentimentSentence =
    sentiment === "cooperative"
      ? "Sneha connected with the debtor and the tone remained cooperative."
      : sentiment === "evasive"
        ? "Sneha connected with the debtor, but responses were vague or non-committal."
        : "Sneha connected with the debtor and the conversation became tense or hostile.";

  if (!snippet) {
    return `${sentimentSentence} Review the recording before escalating further.`;
  }

  return `${sentimentSentence} Key moment: "${snippet}${cleaned.length > 220 ? "..." : ""}"`;
}

export function calculateVapiCreditCost(durationSeconds: number): number {
  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
  return minutes * 3;
}
