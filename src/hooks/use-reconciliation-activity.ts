"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchReconciliationActivityFeed } from "@/lib/dashboard-activity-feed-client";
import { ReconciliationActivityItem } from "@/lib/dashboard-activity-feed";
import { WorkspaceMode } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export function useReconciliationActivity(
  workspaceMode: WorkspaceMode,
  businessId: string | null
) {
  const ledgerRefreshKey = useWorkspaceStore((state) => state.ledgerRefreshKey);
  const walletRefreshKey = useWorkspaceStore((state) => state.walletRefreshKey);
  const [items, setItems] = useState<ReconciliationActivityItem[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (workspaceMode === "business" && !businessId) {
        setItems([]);
        return;
      }

      const data = await fetchReconciliationActivityFeed(workspaceMode, businessId);
      setItems(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load reconciliation activity."
      );
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceMode, businessId]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity, ledgerRefreshKey, walletRefreshKey]);

  return { items, error, isLoading, reload: loadActivity };
}
