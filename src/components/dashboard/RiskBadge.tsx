import { Badge, BadgeTone } from "@/components/ui/Badge";
import { PaymentReliabilityTier } from "@/types";

const TIER_LABELS: Record<PaymentReliabilityTier, string> = {
  excellent: "Excellent",
  good: "Good",
  at_risk: "At Risk",
  defaulter: "High Default Risk",
};

const TIER_TONES: Record<PaymentReliabilityTier, BadgeTone> = {
  excellent: "success",
  good: "neutral",
  at_risk: "warning",
  defaulter: "danger",
};

interface RiskBadgeProps {
  tier?: PaymentReliabilityTier | null;
  riskScore?: number | null;
}

export function RiskBadge({ tier, riskScore }: RiskBadgeProps) {
  const resolvedTier = tier ?? "good";

  return (
    <Badge
      tone={TIER_TONES[resolvedTier]}
      title={
        typeof riskScore === "number"
          ? `Risk score: ${riskScore}/100`
          : undefined
      }
    >
      {TIER_LABELS[resolvedTier]}
    </Badge>
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
