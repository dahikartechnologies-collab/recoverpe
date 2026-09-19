"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/diagnostics", label: "Diagnostics" },
  { href: "/admin/users", label: "User Management" },
  { href: "/admin/agents", label: "Field Agents" },
  { href: "/admin/transactions", label: "Transactions & Support" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {ADMIN_LINKS.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== "/admin" && pathname.startsWith(`${link.href}/`));

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
