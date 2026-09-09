"use client";

import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DashboardAnalyticsSection } from "@/components/dashboard/analytics/DashboardAnalyticsSection";
import { DashboardLedgersSection } from "@/components/dashboard/DashboardLedgersSection";
import { useReconciliationActivity } from "@/hooks/use-reconciliation-activity";

export function PersonalDashboardView() {
  const { items, isLoading } = useReconciliationActivity("personal", null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="type-page-title">Personal Ledger</h1>
        <p className="type-data-secondary mt-3 max-w-2xl text-sm leading-relaxed">
          Informal lending and friend/family balances. No PDFs, no tax fields,
          conversational WhatsApp reminders only.
        </p>
      </div>

      <ActivityFeed items={items} isLoading={isLoading} />

      <DashboardAnalyticsSection workspaceMode="personal" />

      <DashboardLedgersSection workspaceMode="personal" />
    </div>
  );
}
