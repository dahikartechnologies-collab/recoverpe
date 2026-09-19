"use client";

import { PayoutDetailsCard } from "@/components/settings/PayoutDetailsCard";
import { PermissionWorkspaceGuard } from "@/components/dashboard/OwnerWorkspaceGuard";
import { PageHeader } from "@/components/ui/PageHeader";
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
        <PageHeader
          title="Payouts"
          description="Verify your settlement account via Secure Bank Linking, then lock Smart Collect payouts to that verified source."
        />
        <PayoutDetailsCard />
      </div>
    </PermissionWorkspaceGuard>
  );
}
