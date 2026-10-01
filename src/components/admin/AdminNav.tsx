"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Percent,
  ScrollText,
  Users,
  UserCog,
  Wallet,
} from "lucide-react";

const ADMIN_LINKS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/settings", label: "Platform Economics", icon: Percent },
  { href: "/admin/businesses", label: "Business God Mode", icon: Building2 },
  { href: "/admin/diagnostics", label: "Diagnostics", icon: Activity },
  { href: "/admin/users", label: "User Management", icon: UserCog },
  { href: "/admin/agents", label: "Field Agents", icon: Users },
  { href: "/admin/transactions", label: "Transactions & Support", icon: Wallet },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
];

function isAdminNavActive(pathname: string, href: string): boolean {
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const normalizedHref =
    href.length > 1 && href.endsWith("/") ? href.slice(0, -1) : href;

  if (normalizedHref === "/admin") {
    return normalizedPath === "/admin";
  }

  return (
    normalizedPath === normalizedHref ||
    normalizedPath.startsWith(`${normalizedHref}/`)
  );
}

export function AdminNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="-mb-px flex gap-1 overflow-x-auto"
      aria-label="Admin navigation"
    >
      {ADMIN_LINKS.map((link) => {
        const isActive = isAdminNavActive(pathname, link.href);
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
            <Icon className="h-4 w-4" aria-hidden />
            {link.label}
          </Link>
        );
      })}
      <Link
        href="/dashboard"
        className="ml-auto inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-recoverpe-grey-medium hover:text-recoverpe-black"
      >
        <ClipboardList className="h-4 w-4" aria-hidden />
        Merchant dashboard
      </Link>
    </nav>
  );
}
