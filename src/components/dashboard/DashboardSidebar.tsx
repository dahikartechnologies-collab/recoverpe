"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Import, Receipt, Settings, Users, Wallet } from "lucide-react";
import { RecoverpeLogo } from "@/components/brand/RecoverpeLogo";
import { DashboardLogoutButton } from "@/components/dashboard/DashboardLogoutButton";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import {
  canAccessDashboardHome,
  filterNavLinksForContext,
} from "@/lib/workspace-nav-policy";
import { useWorkspaceStore } from "@/store/workspace-store";

const SIDEBAR_LINKS = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/vendors", label: "Vendors", icon: Users, highlight: true },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
  { href: "/dashboard/import", label: "Import", icon: Import },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/billing", label: "Billing", icon: Wallet },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const isOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.isOwnWorkspaceContext
  );
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);
  const navContext = {
    isOwnWorkspaceContext,
    role: workspaceRole,
    permissions: customPermissions,
  };
  const visibleLinks = filterNavLinksForContext(SIDEBAR_LINKS, navContext);
  const homeHref = canAccessDashboardHome(navContext)
    ? "/dashboard"
    : "/dashboard/vendors";

  return (
    <aside className="hidden w-60 shrink-0 border-r border-recoverpe-grey-light bg-recoverpe-white lg:block">
      <div className="sticky top-0 flex h-screen flex-col px-5 py-8">
        <div className="mb-4 px-1">
          <RecoverpeLogo size="sm" href={homeHref} priority />
        </div>

        <div className="mb-8">
          <WorkspaceSwitcher />
        </div>

        <nav className="space-y-1.5">
          {visibleLinks.map((link) => {
            const isActive = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out ${
                  isActive
                    ? "bg-recoverpe-black text-recoverpe-white"
                    : link.highlight
                      ? "text-recoverpe-black hover:bg-recoverpe-grey-light/60"
                      : "text-recoverpe-grey-medium hover:bg-recoverpe-grey-light/60 hover:text-recoverpe-black"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-recoverpe-grey-light pt-6">
          <DashboardLogoutButton />
        </div>
      </div>
    </aside>
  );
}
