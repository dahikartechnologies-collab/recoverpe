"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DashboardAnalytics,
  fetchDashboardAnalytics,
} from "@/lib/dashboard-analytics-client";
import { buildDsoCohortHeatmap } from "@/lib/analytics-dso";
import { buildSankeyFlowFromLedgers } from "@/lib/analytics-sankey";
import { WorkspaceMode } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

const EMPTY_ANALYTICS: DashboardAnalytics = {
  summary: {
    totalOutstanding: 0,
    collectedThisMonth: 0,
    activeDefaulters: 0,
    collectionRate: 0,
    collectedThisMonthChangePercent: null,
    collectionRateChangePercent: null,
    totalOutstandingChangePercent: null,
    activeDefaultersChangePercent: null,
  },
  cashFlow: [],
  aging: [
    { key: "0-30", label: "0–30 days", amount: 0 },
    { key: "31-60", label: "31–60 days", amount: 0 },
    { key: "61+", label: "61+ days", amount: 0 },
  ],
  sankey: buildSankeyFlowFromLedgers([]),
  dsoCohort: buildDsoCohortHeatmap([], []),
};

export function useDashboardAnalytics(
  workspaceMode: WorkspaceMode,
  businessId: string | null
) {
  const ledgerRefreshKey = useWorkspaceStore((state) => state.ledgerRefreshKey);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(EMPTY_ANALYTICS);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (workspaceMode === "business" && !businessId) {
        setAnalytics(EMPTY_ANALYTICS);
        return;
      }

      const data = await fetchDashboardAnalytics(workspaceMode, businessId);
      setAnalytics(data);
    } catch (loadError) {
      setAnalytics(EMPTY_ANALYTICS);
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
