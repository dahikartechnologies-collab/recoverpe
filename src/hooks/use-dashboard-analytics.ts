"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DashboardAnalytics,
  EMPTY_DASHBOARD_ANALYTICS,
} from "@/lib/dashboard-analytics";
import { fetchDashboardHome } from "@/lib/dashboard-home-client";
import { WorkspaceMode } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export function useDashboardAnalytics(
  workspaceMode: WorkspaceMode,
  businessId: string | null
) {
  const ledgerRefreshKey = useWorkspaceStore((state) => state.ledgerRefreshKey);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(
    EMPTY_DASHBOARD_ANALYTICS
  );
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (workspaceMode === "business" && !businessId) {
        setAnalytics(EMPTY_DASHBOARD_ANALYTICS);
        return;
      }

      const data = await fetchDashboardHome(workspaceMode, businessId);
      setAnalytics(data.analytics);
    } catch (loadError) {
      setAnalytics(EMPTY_DASHBOARD_ANALYTICS);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load analytics."
      );
    } finally {
      setIsLoading(false);
    }
  }, [workspaceMode, businessId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics, ledgerRefreshKey]);

  return {
    analytics,
    error,
    isLoading,
    reload: loadAnalytics,
  };
}
