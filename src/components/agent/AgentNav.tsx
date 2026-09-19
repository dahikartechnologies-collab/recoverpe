"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, Briefcase, FileCheck2, Menu, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { type AgentTab } from "@/lib/agent/tab-state";
import { useAgentTab } from "@/hooks/use-agent-tab";
import { persistActiveContext } from "@/lib/post-auth-navigation";

const AGENT_LINKS: Array<{
  hash: AgentTab;
  label: string;
  icon: typeof BarChart3;
}> = [
  {
    hash: "performance",
    label: "Performance",
    icon: BarChart3,
  },
  {
    hash: "leads",
    label: "Leads",
    icon: Users,
  },
  {
    hash: "kyc",
    label: "KYC",
    icon: FileCheck2,
  },
];

export function AgentNav() {
  const router = useRouter();
  const { activeTab, navigateToTab } = useAgentTab();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  async function switchToMerchant() {
    await persistActiveContext("merchant");
    router.push("/dashboard");
  }

  function handleTabClick(tab: AgentTab) {
    navigateToTab(tab);
    setIsMobileMenuOpen(false);
  }

  return (
    <nav className="border-b border-recoverpe-line bg-recoverpe-white">
      <div className="border-b border-recoverpe-success-line bg-recoverpe-success-fill px-4 py-2 sm:px-6">
        <Badge tone="success" className="text-xs sm:text-[11px]">
          TIER-1 V2.0 ACTIVE
        </Badge>
      </div>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="hidden flex-1 gap-1 overflow-x-auto md:flex">
          {AGENT_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.hash;

            return (
              <button
                key={link.hash}
                type="button"
                onClick={() => handleTabClick(link.hash)}
                className={`rp-interactive inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium ${
                  isActive
                    ? "border-recoverpe-black text-recoverpe-black"
                    : "border-transparent text-recoverpe-muted hover:text-recoverpe-black"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {link.label}
              </button>
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
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-recoverpe-line px-4 py-3 md:hidden">
          <div className="space-y-1">
            {AGENT_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = activeTab === link.hash;

              return (
                <button
                  key={link.hash}
                  type="button"
                  onClick={() => handleTabClick(link.hash)}
                  className={`rp-interactive flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                    isActive
                      ? "bg-recoverpe-black text-recoverpe-white"
                      : "text-recoverpe-black hover:bg-recoverpe-fill"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {link.label}
                </button>
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
