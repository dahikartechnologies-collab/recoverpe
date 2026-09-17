"use client";

import { PayoutDetailsCard } from "@/components/settings/PayoutDetailsCard";
import { PermissionWorkspaceGuard } from "@/components/dashboard/OwnerWorkspaceGuard";
import { canEditBusinessSettings } from "@/lib/workspace-permissions";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function PayoutSettingsPage() {
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);

  return (
    <PermissionWorkspaceGuard
      canAccess={canEditBusinessSettings(workspaceRole, customPermissions)}
    >
      <div className="space-y-6">
        <div>
          <h1 className="type-page-title">Payouts</h1>
          <p className="type-data-secondary mt-3 text-sm leading-relaxed">
            Configure Razorpay Route bank details so Smart Collect settlements
            reach your account with zero MDR.
          </p>
        </div>
        <PayoutDetailsCard />
      </div>
    </PermissionWorkspaceGuard>
  );
}
