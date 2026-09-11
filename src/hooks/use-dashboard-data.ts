"use client";

import { useCallback, useEffect, useState } from "react";
import { LEDGER_PAGE_SIZE } from "@/lib/ledger-queries";
import { fetchDashboardHome } from "@/lib/dashboard-home-client";
import { fetchLedgers } from "@/lib/ledgers";
import { DashboardMetrics, LedgerPagination, LedgerWithContact, WorkspaceMode } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

const EMPTY_METRICS: DashboardMetrics = {
  totalOutstanding: 0,
  severelyOverdue: 0,
  recoveredViaRecoverpe: 0,
};

const EMPTY_PAGINATION: LedgerPagination = {
  total: 0,
  limit: LEDGER_PAGE_SIZE,
  offset: 0,
  page: 1,
  hasMore: false,
};

export function useDashboardData(
  workspaceMode: WorkspaceMode,
  businessId: string | null
) {
  const ledgerRefreshKey = useWorkspaceStore((state) => state.ledgerRefreshKey);
  const [ledgers, setLedgers] = useState<LedgerWithContact[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [pagination, setPagination] = useState<LedgerPagination>(EMPTY_PAGINATION);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError("");

      try {
        if (workspaceMode === "business" && !businessId) {
          setLedgers([]);
          setMetrics(EMPTY_METRICS);
          setPagination(EMPTY_PAGINATION);
          return;
        }

        if (page === 1) {
          const home = await fetchDashboardHome(workspaceMode, businessId);
          setLedgers(home.ledgers);
          setMetrics(home.metrics);
          setPagination(home.pagination);
          return;
        }

        const response = await fetchLedgers(workspaceMode, businessId, {
          page,
          limit: LEDGER_PAGE_SIZE,
        });
        setLedgers(response.ledgers);
        setMetrics(response.metrics);
        setPagination(response.pagination);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load dashboard data."
        );
        setLedgers([]);
        setMetrics(EMPTY_METRICS);
        setPagination(EMPTY_PAGINATION);
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceMode, businessId]
  );

  useEffect(() => {
    void loadDashboardData(1);
  }, [loadDashboardData, ledgerRefreshKey]);

  const goToPreviousPage = useCallback(() => {
    if (pagination.page <= 1) {
      return;
    }

    void loadDashboardData(pagination.page - 1);
  }, [loadDashboardData, pagination.page]);

  const goToNextPage = useCallback(() => {
    if (!pagination.hasMore) {
      return;
    }

    void loadDashboardData(pagination.page + 1);
  }, [loadDashboardData, pagination.hasMore, pagination.page]);

  return {
    ledgers,
    metrics,
    pagination,
    error,
    isLoading,
    reload: () => loadDashboardData(pagination.page),
    goToPreviousPage,
    goToNextPage,
  };
}
