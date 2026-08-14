"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { AddBusinessModal } from "@/components/dashboard/AddBusinessModal";
import { GhostModeBanner } from "@/components/dashboard/GhostModeBanner";
import { NewLedgerModal } from "@/components/dashboard/NewLedgerModal";
import { WorkspaceToggle } from "@/components/dashboard/WorkspaceToggle";
import { UpgradeToPremiumModal } from "@/components/billing/UpgradeToPremiumModal";
import { fetchBusinesses } from "@/lib/businesses";
import { getFirebaseAuth } from "@/lib/firebase";
import { FREE_PLAN_LEDGER_LIMIT } from "@/lib/razorpay-products";
import { fetchCurrentUser } from "@/lib/users";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Button } from "@/components/ui/Button";

interface DashboardShellProps {
  children: ReactNode;
}

function formatWalletCredits(balance: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(balance);
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setBusinesses = useWorkspaceStore((state) => state.setBusinesses);
  const openLedgerModal = useWorkspaceStore((state) => state.openLedgerModal);
  const openUpgradeModal = useWorkspaceStore((state) => state.openUpgradeModal);
  const setUserBillingState = useWorkspaceStore((state) => state.setUserBillingState);
  const setGhostMode = useWorkspaceStore((state) => state.setGhostMode);
  const ghostModeUserId = useWorkspaceStore((state) => state.ghostModeUserId);
  const subscriptionPlan = useWorkspaceStore((state) => state.subscriptionPlan);
  const ledgerCount = useWorkspaceStore((state) => state.ledgerCount);
  const walletRefreshKey = useWorkspaceStore((state) => state.walletRefreshKey);
  const userRefreshKey = useWorkspaceStore((state) => state.userRefreshKey);
  const [loadError, setLoadError] = useState("");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    const impersonateUserId = searchParams.get("impersonate")?.trim() || null;

    if (impersonateUserId) {
      setGhostMode(impersonateUserId, null);
    }
  }, [searchParams, setGhostMode]);

  const loadDashboardData = useCallback(async () => {
    try {
      const businesses = await fetchBusinesses();
      setBusinesses(businesses);

      const user = await fetchCurrentUser();
      setWalletBalance(Number(user.vapi_wallet_balance));
      setUserBillingState(user.subscription_plan, user.ledger_count);
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load dashboard data."
      );
    }
  }, [setBusinesses, setUserBillingState]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      await loadDashboardData();
    });

    return () => unsubscribe();
  }, [router, loadDashboardData]);

  useEffect(() => {
    void loadDashboardData();
  }, [walletRefreshKey, userRefreshKey, ghostModeUserId, loadDashboardData]);

  function handleNewEntry() {
    if (ghostModeUserId) {
      return;
    }

    if (
      subscriptionPlan === "free" &&
      ledgerCount >= FREE_PLAN_LEDGER_LIMIT
    ) {
      openUpgradeModal();
      return;
    }

    openLedgerModal();
  }

  return (
    <div className="min-h-screen bg-recoverpe-white">
      <GhostModeBanner />
      <header className="border-b border-recoverpe-grey-light px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-recoverpe-black"
              >
                Recoverpe
              </Link>
              <span className="rounded-md border border-recoverpe-grey-light px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                {subscriptionPlan === "premium" ? "Premium" : "Free"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/import"
                className="hidden rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm font-medium text-recoverpe-black sm:inline-flex"
              >
                Import
              </Link>
              <Link
                href="/dashboard/billing"
                className="hidden rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm font-medium text-recoverpe-black sm:inline-flex"
              >
                Billing
              </Link>
              <div className="rounded-md border border-recoverpe-grey-light px-3 py-2 text-right">
                <p className="text-[11px] font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                  AI Credits
                </p>
                <p className="text-sm font-semibold tabular-nums text-recoverpe-black">
                  {walletBalance === null
                    ? "—"
                    : `${formatWalletCredits(walletBalance)} left`}
                </p>
              </div>
              <Button
                type="button"
                onClick={handleNewEntry}
                disabled={Boolean(ghostModeUserId)}
              >
                New Entry
              </Button>
            </div>
          </div>
          <WorkspaceToggle />
          {loadError ? (
            <p className="text-sm text-recoverpe-error">{loadError}</p>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      <AddBusinessModal />
      <NewLedgerModal />
      <UpgradeToPremiumModal />
    </div>
  );
}
