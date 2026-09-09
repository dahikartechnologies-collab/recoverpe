import { PaymentReliabilityTier } from "@/types";

const TIER_LABELS: Record<PaymentReliabilityTier, string> = {
  excellent: "Excellent",
  good: "Good",
  at_risk: "At Risk",
  defaulter: "High Default Risk",
};

const TIER_STYLES: Record<PaymentReliabilityTier, string> = {
  excellent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  good: "border-recoverpe-grey-light bg-recoverpe-grey-light text-recoverpe-black",
  at_risk: "border-amber-200 bg-amber-50 text-amber-700",
  defaulter: "border-red-200 bg-red-50 text-red-600",
};

interface RiskBadgeProps {
  tier?: PaymentReliabilityTier | null;
  riskScore?: number | null;
}

export function RiskBadge({ tier, riskScore }: RiskBadgeProps) {
  const resolvedTier = tier ?? "good";
  const label = TIER_LABELS[resolvedTier];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TIER_STYLES[resolvedTier]}`}
      title={
        typeof riskScore === "number"
          ? `Risk score: ${riskScore}/100`
          : undefined
      }
    >
      {label}
    </span>
  );
}

export function resolvePaymentReliabilityTier(
  riskScore: number
): PaymentReliabilityTier {
  if (riskScore <= 25) {
    return "excellent";
  }

  if (riskScore <= 50) {
    return "good";
  }

  if (riskScore <= 75) {
    return "at_risk";
  }

  return "defaulter";
}
