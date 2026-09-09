import { AppRole, CustomPermissions } from "@/types";

export const OWNER_WORKSPACE_ONLY_HREFS = [
  "/dashboard/billing",
] as const;

export interface WorkspaceNavContext {
  isOwnWorkspaceContext: boolean;
  role: AppRole | null;
  permissions: CustomPermissions;
}

export function canAccessDashboardHome({
  isOwnWorkspaceContext,
  role,
  permissions,
}: WorkspaceNavContext): boolean {
  if (isOwnWorkspaceContext || role === "owner") {
    return true;
  }

  return permissions.edit_ledgers || permissions.manage_team;
}

export function canAccessSettingsArea({
  isOwnWorkspaceContext,
  role,
  permissions,
}: WorkspaceNavContext): boolean {
  if (isOwnWorkspaceContext || role === "owner") {
    return true;
  }

  return permissions.edit_settings || permissions.manage_team;
}

export function canAccessBillingNav({
  isOwnWorkspaceContext,
  role,
}: Pick<WorkspaceNavContext, "isOwnWorkspaceContext" | "role">): boolean {
  return isOwnWorkspaceContext || role === "owner";
}

export function canAccessImportNav({
  isOwnWorkspaceContext,
  role,
  permissions,
}: WorkspaceNavContext): boolean {
  if (isOwnWorkspaceContext || role === "owner") {
    return true;
  }

  return permissions.edit_ledgers || permissions.manage_team;
}

/** True restricted partners lack both settings delegation flags. */
export function isRestrictedPartnerContext({
  isOwnWorkspaceContext,
  role,
  permissions,
}: WorkspaceNavContext): boolean {
  if (isOwnWorkspaceContext || role === "owner") {
    return false;
  }

  return !permissions.edit_settings && !permissions.manage_team;
}

export function isAssignedPartnerContext(isOwnWorkspaceContext: boolean): boolean {
  return !isOwnWorkspaceContext;
}

export function filterNavLinksForContext<
  T extends { href: string }
>(links: T[], navContext: WorkspaceNavContext): T[] {
  return links.filter((link) => {
    if (link.href === "/dashboard") {
      return canAccessDashboardHome(navContext);
    }

    if (link.href === "/dashboard/settings" || link.href.startsWith("/dashboard/settings")) {
      return canAccessSettingsArea(navContext);
    }

    if (link.href === "/dashboard/billing" || link.href.startsWith("/dashboard/billing")) {
      return canAccessBillingNav(navContext);
    }

    if (link.href === "/dashboard/import" || link.href.startsWith("/dashboard/import")) {
      return canAccessImportNav(navContext);
    }

    return true;
  });
}
