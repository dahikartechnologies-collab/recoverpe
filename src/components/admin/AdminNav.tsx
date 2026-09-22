"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/settings", label: "Platform Economics" },
  { href: "/admin/businesses", label: "Business God Mode" },
  { href: "/admin/diagnostics", label: "Diagnostics" },
  { href: "/admin/users", label: "User Management" },
  { href: "/admin/agents", label: "Field Agents" },
  { href: "/admin/transactions", label: "Transactions & Support" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
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
    <nav className="flex flex-wrap gap-2" aria-label="Admin navigation">
      {ADMIN_LINKS.map((link) => {
        const isActive = isAdminNavActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rp-interactive rounded-md border px-3 py-2 text-sm font-medium ${
              isActive
                ? "border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
                : "border-recoverpe-line bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-fill"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
