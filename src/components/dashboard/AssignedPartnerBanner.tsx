"use client";

import { useWorkspaceStore } from "@/store/workspace-store";
import { isRestrictedPartnerContext } from "@/lib/workspace-nav-policy";
import { formatAppRoleLabel } from "@/lib/workspace-permissions";

export function AssignedPartnerBanner() {
  const isOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.isOwnWorkspaceContext
  );
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businessName =
    businesses.find((business) => business.id === activeBusinessId)?.business_name ??
    "Assigned business";

  const navContext = {
    isOwnWorkspaceContext,
    role: workspaceRole,
    permissions: customPermissions,
  };

  if (!isRestrictedPartnerContext(navContext)) {
    return null;
  }

  return (
    <div className="border-b border-recoverpe-grey-light bg-recoverpe-grey-light/30 px-6 py-3 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-recoverpe-grey-medium">Partner access</p>
        <p className="mt-1 text-sm font-semibold text-recoverpe-black">
          {formatAppRoleLabel(workspaceRole ?? "field_staff")} · {businessName}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-recoverpe-grey-medium">
          You are working in a partner-assigned role with limited workspace access.
          Switch to My Account for your own workspace.
        </p>
      </div>
    </div>
  );
}
