"use client";

import { DashboardLedgersSection } from "@/components/dashboard/DashboardLedgersSection";

export function PersonalDashboardView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-recoverpe-black">
          Personal Ledger
        </h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Informal lending and friend/family balances. No PDFs, no tax fields,
          conversational WhatsApp reminders only.
        </p>
      </div>

      <DashboardLedgersSection workspaceMode="personal" />
    </div>
  );
}
