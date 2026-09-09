"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { DashboardLogoutButton } from "@/components/dashboard/DashboardLogoutButton";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { filterNavLinksForContext } from "@/lib/workspace-nav-policy";
import { useWorkspaceStore } from "@/store/workspace-store";

const MOBILE_NAV_LINKS = [
  { href: "/dashboard", label: "Home", exact: true },
  { href: "/dashboard/vendors", label: "Vendors", highlight: true },
  { href: "/dashboard/import", label: "Import" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function MobileDashboardNav() {
  const pathname = usePathname();
  const isOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.isOwnWorkspaceContext
  );
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);
  const isSuperAdmin = useWorkspaceStore((state) => state.isSuperAdmin);
  const navContext = {
    isOwnWorkspaceContext,
    role: workspaceRole,
    permissions: customPermissions,
  };
  const visibleLinks = filterNavLinksForContext(MOBILE_NAV_LINKS, navContext);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-recoverpe-grey-light bg-recoverpe-white sm:hidden">
      <div className="space-y-2 border-b border-recoverpe-grey-light px-4 py-3">
        <WorkspaceSwitcher compact />
        {isSuperAdmin ? (
          <Link
            href="/admin"
            className={`focus-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors ${
              pathname.startsWith("/admin")
                ? "text-recoverpe-black"
                : "text-recoverpe-grey-medium"
            }`}
          >
            <Shield className="h-3.5 w-3.5" aria-hidden />
            Admin Console
          </Link>
        ) : null}
      </div>
      <DashboardLogoutButton variant="mobile" />
      <div
        className="mx-auto grid max-w-6xl"
        style={{
          gridTemplateColumns: `repeat(${Math.max(visibleLinks.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {visibleLinks.map((link) => {
          const isActive =
            link.exact === true
              ? pathname === link.href
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-1.5 py-3 text-center text-[10px] font-medium uppercase tracking-wide transition-colors ${
                isActive
                  ? "font-semibold text-recoverpe-black"
                  : link.highlight
                    ? "text-recoverpe-black"
                    : "text-recoverpe-grey-medium"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
