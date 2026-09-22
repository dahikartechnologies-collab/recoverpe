"use client";

import { resolveEffectiveTier } from "@/lib/entitlements";
import { hasPaidTierBenefits } from "@/lib/tier-fulfillment";
import { Tier } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export function formatWorkspaceTierLabel(tier: Tier | "free"): string {
  if (tier === "free") {
    return "Free";
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function useActiveBusinessBilling() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);

  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;

  const effectiveTier = activeBusiness
    ? resolveEffectiveTier(activeBusiness)
    : ("starter" as Tier);
  const hasPaidTier = hasPaidTierBenefits(activeBusiness);
  const isFreeTier = !hasPaidTier;

  return {
    activeBusiness,
    effectiveTier,
    hasPaidTierBenefits: hasPaidTier,
    isFreeTier,
    tierBadgeLabel: formatWorkspaceTierLabel(
      activeBusiness?.subscription_tier === "free" ? "free" : effectiveTier
    ),
  };
}
