"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLedgers } from "@/lib/ledgers";
import { DashboardMetrics, LedgerWithContact, WorkspaceMode } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

const EMPTY_METRICS: DashboardMetrics = {
  totalOutstanding: 0,
  severelyOverdue: 0,
  recoveredViaRecoverpe: 0,
};

export function useDashboardData(
  workspaceMode: WorkspaceMode,
  businessId: string | null
) {
  const ledgerRefreshKey = useWorkspaceStore((state) => state.ledgerRefreshKey);
  const [ledgers, setLedgers] = useState<LedgerWithContact[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (workspaceMode === "business" && !businessId) {
        setLedgers([]);
        setMetrics(EMPTY_METRICS);
        return;
      }

      const response = await fetchLedgers(workspaceMode, businessId);
      setLedgers(response.ledgers);
      setMetrics(response.metrics);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load dashboard data."
      );
      setLedgers([]);
      setMetrics(EMPTY_METRICS);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceMode, businessId]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData, ledgerRefreshKey]);

  return {
    ledgers,
    metrics,
    error,
    isLoading,
    reload: loadDashboardData,
  };
}
