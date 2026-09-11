"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  fetchBusinessInsights,
  type BusinessInsightsResponse,
} from "@/lib/insights-client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { runWhenIdle } from "@/lib/idle";
import { WorkspaceMode } from "@/types";

interface BusinessInsightsCardProps {
  workspaceMode: WorkspaceMode;
  businessId?: string | null;
}

export function BusinessInsightsCard({
  workspaceMode,
  businessId = null,
}: BusinessInsightsCardProps) {
  const ledgerRefreshKey = useWorkspaceStore((state) => state.ledgerRefreshKey);
  const openUpgradeModal = useWorkspaceStore((state) => state.openUpgradeModal);
  const [insights, setInsights] = useState<BusinessInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInsights = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (workspaceMode === "business" && !businessId) {
        setInsights(null);
        return;
      }

      setInsights(await fetchBusinessInsights(workspaceMode, businessId));
    } catch (loadError) {
      setInsights(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load insights."
      );
    } finally {
      setIsLoading(false);
    }
  }, [workspaceMode, businessId]);

  useEffect(() => {
    return runWhenIdle(() => {
      void loadInsights();
    }, 1600);
  }, [loadInsights, ledgerRefreshKey]);

  return (
    <Card>
      <CardContent className="p-5">
        <p className="type-eyebrow">Business pulse</p>
        <h3 className="mt-1 text-base font-semibold text-recoverpe-black">
          Sales &amp; expense insights
        </h3>

        {isLoading ? (
          <p className="mt-3 text-sm text-recoverpe-grey-medium">
            Reading this month&apos;s books...
          </p>
        ) : error ? (
          <p className="mt-3 text-sm text-recoverpe-error">{error}</p>
        ) : insights ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm font-medium text-recoverpe-black">
              {insights.narrative?.headline ?? insights.pulse.headline}
            </p>
            <ul className="space-y-2 text-sm text-recoverpe-grey-medium">
              {(insights.narrative?.bullets ??
                insights.pulse.bullets.map((bullet) => bullet.detail)
              )
                .slice(0, insights.is_premium ? 5 : 3)
                .map((item) => (
                  <li key={item}>{item}</li>
                ))}
            </ul>

            {insights.is_premium && insights.narrative?.actions.length ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                  This week
                </p>
                <ul className="mt-1 space-y-1 text-sm text-recoverpe-black">
                  {insights.narrative.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!insights.is_premium ? (
              <div className="border-t border-recoverpe-grey-light pt-3">
                <p className="text-xs text-recoverpe-grey-medium">
                  Premium adds a written briefing and this week&apos;s actions,
                  refreshed through the day from your live books.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2 min-h-9 px-3 py-1.5 text-xs"
                  onClick={openUpgradeModal}
                >
                  Unlock AI briefing
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-recoverpe-grey-medium">
            Record a sale or an expense to see a briefing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
