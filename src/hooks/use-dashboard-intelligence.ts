"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DashboardIntelligence,
} from "@/lib/dashboard-intelligence-client";
import { fetchDashboardHome } from "@/lib/dashboard-home-client";
import { WorkspaceMode } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

const EMPTY_INTELLIGENCE: DashboardIntelligence = {
  wall_of_shame: [],
  hostile_calls: [],
  pending_verifications: [],
};

export function useDashboardIntelligence(
  workspaceMode: WorkspaceMode,
  businessId: string | null
) {
  const ledgerRefreshKey = useWorkspaceStore((state) => state.ledgerRefreshKey);
  const [intelligence, setIntelligence] =
    useState<DashboardIntelligence>(EMPTY_INTELLIGENCE);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadIntelligence = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (workspaceMode === "business" && !businessId) {
        setIntelligence(EMPTY_INTELLIGENCE);
        return;
      }

      const data = await fetchDashboardHome(workspaceMode, businessId);
      setIntelligence(data.intelligence);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load dashboard intelligence."
      );
      setIntelligence(EMPTY_INTELLIGENCE);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceMode, businessId]);

  useEffect(() => {
    void loadIntelligence();
  }, [loadIntelligence, ledgerRefreshKey]);

  return {
    intelligence,
    error,
    isLoading,
    reload: loadIntelligence,
  };
}
