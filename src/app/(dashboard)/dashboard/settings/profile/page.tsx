"use client";

import { BusinessProfileView } from "@/components/settings/BusinessProfileView";
import { DangerZone } from "@/components/settings/DangerZone";
import { PermissionWorkspaceGuard } from "@/components/dashboard/OwnerWorkspaceGuard";
import { canEditBusinessSettings } from "@/lib/workspace-permissions";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function BusinessProfileSettingsPage() {
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);
  const isOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.isOwnWorkspaceContext
  );
  const showDangerZone = workspaceRole === "owner" && isOwnWorkspaceContext;

  return (
    <PermissionWorkspaceGuard
      canAccess={canEditBusinessSettings(workspaceRole, customPermissions)}
    >
      <div className="space-y-8">
        <BusinessProfileView />
        {showDangerZone ? <DangerZone /> : null}
      </div>
    </PermissionWorkspaceGuard>
  );
}
