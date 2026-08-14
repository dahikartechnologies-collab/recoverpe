"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "User Management" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {ADMIN_LINKS.map((link) => {
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
                : "border-recoverpe-grey-light bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
