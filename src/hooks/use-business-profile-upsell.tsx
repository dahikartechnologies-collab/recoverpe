"use client";

import { useCallback, useMemo, useState } from "react";
import { CompleteBusinessProfileModal } from "@/components/dashboard/CompleteBusinessProfileModal";
import { isBusinessProfileCompleteForLegalDocuments } from "@/lib/business-profile";
import { useWorkspaceStore } from "@/store/workspace-store";

export function useBusinessProfileUpsell() {
  const businesses = useWorkspaceStore((state) => state.businesses);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const mode = useWorkspaceStore((state) => state.mode);
  const [isOpen, setIsOpen] = useState(false);

  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeBusinessId) ?? null,
    [businesses, activeBusinessId]
  );

  const profileComplete = isBusinessProfileCompleteForLegalDocuments(activeBusiness);

  const requireCompleteProfile = useCallback((): boolean => {
    if (mode !== "business" || profileComplete) {
      return true;
    }

    setIsOpen(true);
    return false;
  }, [mode, profileComplete]);

  const profileUpsellModal = (
    <CompleteBusinessProfileModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
    />
  );

  return {
    requireCompleteProfile,
    profileUpsellModal,
    profileComplete,
    gateLegalDocuments: mode === "business" && !profileComplete,
  };
}
