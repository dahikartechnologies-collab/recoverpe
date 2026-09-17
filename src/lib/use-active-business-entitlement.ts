"use client";

import { useMemo } from "react";
import {
  BusinessEntitlementRow,
  EntitlementKey,
  hasEntitlement,
  isPremiumTierBusiness,
  isZeroMdrCheckoutEligible,
} from "@/lib/entitlements";
import { useWorkspaceStore } from "@/store/workspace-store";

export function useActiveBusinessEntitlements() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);

  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;

  const entitlementRow: BusinessEntitlementRow | null = useMemo(
    () =>
      activeBusiness
        ? { subscription_tier: activeBusiness.subscription_tier }
        : null,
    [activeBusiness]
  );

  return {
    activeBusiness,
    entitlementRow,
    hasEntitlement: (key: EntitlementKey) =>
      hasEntitlement(entitlementRow, key),
    isPremium: isPremiumTierBusiness(entitlementRow),
    isZeroMdrEligible: isZeroMdrCheckoutEligible(entitlementRow),
  };
}
