"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, FileCheck2, Users } from "lucide-react";

const AGENT_LINKS = [
  { href: "/agent-dashboard#performance", hash: "performance", label: "Performance", icon: BarChart3 },
  { href: "/agent-dashboard#leads", hash: "leads", label: "Leads", icon: Users },
  { href: "/agent-dashboard#kyc", hash: "kyc", label: "KYC", icon: FileCheck2 },
];

export function AgentNav() {
  const [activeHash, setActiveHash] = useState("performance");

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.replace("#", "") || "performance";
      setActiveHash(hash);
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <nav className="border-b border-recoverpe-grey-light bg-recoverpe-white">
      <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-6">
        {AGENT_LINKS.map((link) => {
          const Icon = link.icon;
          const isActive =
            activeHash === link.hash ||
            (link.hash === "performance" && !["leads", "kyc"].includes(activeHash));

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
      </div>
    </nav>
  );
}
