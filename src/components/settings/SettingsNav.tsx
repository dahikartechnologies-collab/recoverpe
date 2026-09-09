"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Bell, Settings, Users } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  canAccessAccountSettings,
  canAccessTeamSettings,
  canEditBusinessSettings,
} from "@/lib/workspace-permissions";
import { CustomPermissions } from "@/types";

type WorkspaceRole = ReturnType<typeof useWorkspaceStore.getState>["workspaceRole"];

const SETTINGS_LINKS: Array<{
  href: string;
  label: string;
  icon: typeof Settings;
  exact: boolean;
  visible: (
    role: WorkspaceRole,
    permissions: CustomPermissions,
    isOwnWorkspaceContext: boolean
  ) => boolean;
}> = [
  {
    href: "/dashboard/settings",
    label: "Account",
    icon: Settings,
    exact: true,
    visible: (_role, _permissions, isOwnWorkspaceContext) =>
      canAccessAccountSettings(isOwnWorkspaceContext),
  },
  {
    href: "/dashboard/settings/team",
    label: "Team",
    icon: Users,
    exact: false,
    visible: (role, permissions) => canAccessTeamSettings(role, permissions),
  },
  {
    href: "/dashboard/settings/profile",
    label: "Business Profile",
    icon: Building2,
    exact: false,
    visible: (role, permissions) => canEditBusinessSettings(role, permissions),
  },
  {
    href: "/dashboard/settings/notifications",
    label: "Notifications",
    icon: Bell,
    exact: false,
    visible: (role, permissions) => canEditBusinessSettings(role, permissions),
  },
];

export function SettingsNav() {
  const pathname = usePathname();
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);
  const isOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.isOwnWorkspaceContext
  );

  const visibleLinks = SETTINGS_LINKS.filter((link) =>
    link.visible(workspaceRole, customPermissions, isOwnWorkspaceContext)
  );

  if (visibleLinks.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 border-b border-recoverpe-grey-light">
      <nav className="-mb-px flex gap-2 overflow-x-auto">
        {visibleLinks.map((link) => {
          const isActive = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "border-recoverpe-black text-recoverpe-black"
                  : "border-transparent text-recoverpe-grey-medium hover:text-recoverpe-black"
              }`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
