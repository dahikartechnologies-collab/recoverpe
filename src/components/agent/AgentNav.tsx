"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Briefcase, FileCheck2, Menu, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { parseAgentTab, type AgentTab } from "@/lib/agent/tab-state";
import { persistActiveContext } from "@/lib/post-auth-navigation";

const AGENT_LINKS: Array<{
  href: string;
  hash: AgentTab;
  label: string;
  icon: typeof BarChart3;
}> = [
  {
    href: "/agent-dashboard#performance",
    hash: "performance",
    label: "Performance",
    icon: BarChart3,
  },
  {
    href: "/agent-dashboard#leads",
    hash: "leads",
    label: "Leads",
    icon: Users,
  },
  {
    href: "/agent-dashboard#kyc",
    hash: "kyc",
    label: "KYC",
    icon: FileCheck2,
  },
];

export function AgentNav() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AgentTab>("performance");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.replace("#", "");
      setActiveTab(parseAgentTab(hash || "performance"));
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  async function switchToMerchant() {
    await persistActiveContext("merchant");
    router.push("/dashboard");
  }

  return (
    <nav className="border-b border-recoverpe-line bg-recoverpe-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="hidden flex-1 gap-1 overflow-x-auto md:flex">
          {AGENT_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.hash;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rp-interactive inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium ${
                  isActive
                    ? "border-recoverpe-black text-recoverpe-black"
                    : "border-transparent text-recoverpe-muted hover:text-recoverpe-black"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Close agent menu" : "Open agent menu"}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? (
              <X className="h-4 w-4" aria-hidden />
            ) : (
              <Menu className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden shrink-0 gap-2 md:inline-flex"
          onClick={() => void switchToMerchant()}
        >
          <Briefcase className="h-4 w-4" aria-hidden />
          Switch to Merchant Dashboard
        </Button>
      </div>

      {isMobileMenuOpen ? (
        <div className="border-t border-recoverpe-line px-4 py-3 md:hidden">
          <div className="space-y-1">
            {AGENT_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = activeTab === link.hash;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`rp-interactive flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium ${
                    isActive
                      ? "bg-recoverpe-black text-recoverpe-white"
                      : "text-recoverpe-black hover:bg-recoverpe-fill"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {link.label}
                </Link>
              );
            })}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3 w-full gap-2"
            onClick={() => {
              setIsMobileMenuOpen(false);
              void switchToMerchant();
            }}
          >
            <Briefcase className="h-4 w-4" aria-hidden />
            Switch to Merchant Dashboard
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
