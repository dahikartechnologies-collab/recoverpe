"use client";

import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { AddBusinessModal } from "@/components/dashboard/AddBusinessModal";
import { AutopilotAlerts } from "@/components/dashboard/AutopilotAlerts";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { AssignedPartnerBanner } from "@/components/dashboard/AssignedPartnerBanner";
import { GhostModeBanner } from "@/components/dashboard/GhostModeBanner";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { MobileDashboardNav } from "@/components/dashboard/MobileDashboardNav";
import { WorkspaceInvitationsInbox } from "@/components/dashboard/WorkspaceInvitationsInbox";
import { WorkspaceToggle } from "@/components/dashboard/WorkspaceToggle";
import { Toast } from "@/components/ui/Toast";
import { invalidateDashboardCache } from "@/lib/dashboard-request-cache";
import { fetchDashboardSession } from "@/lib/dashboard-session-client";
import { getPostLoginRoute, setAppRoleCookie } from "@/lib/kiosk-client";
import { setActorUserCookie, getActorUserIdFromDocument } from "@/lib/auth-cookies";
import {
  canAccessBillingNav,
  canAccessDashboardHome,
  canAccessImportNav,
  canAccessSettingsArea,
} from "@/lib/workspace-nav-policy";
import { canMutateLedgers } from "@/lib/workspace-permissions";
import {
  getWorkspaceCookiesFromDocument,
  hasShownMultiWorkspaceToast,
  markMultiWorkspaceToastShown,
  restoreWorkspaceContextFromCookies,
  setWorkspaceCookies,
} from "@/lib/workspace-context";
import { FREE_PLAN_LEDGER_LIMIT } from "@/lib/razorpay-products";
import { AccountPendingPurgeError, AccountSuspendedError } from "@/lib/users";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Button } from "@/components/ui/Button";

const GlobalTransactionModal = dynamic(
  () =>
    import("@/components/dashboard/GlobalTransactionModal").then(
      (mod) => mod.GlobalTransactionModal
    ),
  { ssr: false }
);

const UpgradeToPremiumModal = dynamic(
  () =>
    import("@/components/billing/UpgradeToPremiumModal").then(
      (mod) => mod.UpgradeToPremiumModal
    ),
  { ssr: false }
);

const GlobalLedgerViewHost = dynamic(
  () =>
    import("@/components/dashboard/GlobalLedgerViewHost").then(
      (mod) => mod.GlobalLedgerViewHost
    ),
  { ssr: false }
);

interface DashboardShellProps {
  children: ReactNode;
  hasSessionHint?: boolean;
}

function formatWalletCredits(balance: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(balance);
}

export function DashboardShell({
  children,
  hasSessionHint = false,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthReady } = useAuth();
  const setBusinesses = useWorkspaceStore((state) => state.setBusinesses);
  const setAccessibleWorkspaces = useWorkspaceStore(
    (state) => state.setAccessibleWorkspaces
  );
  const setMode = useWorkspaceStore((state) => state.setMode);
  const setActiveBusinessId = useWorkspaceStore((state) => state.setActiveBusinessId);
  const openLedgerModal = useWorkspaceStore((state) => state.openLedgerModal);
  const openUpgradeModal = useWorkspaceStore((state) => state.openUpgradeModal);
  const setUserBillingState = useWorkspaceStore((state) => state.setUserBillingState);
  const setWorkspaceRole = useWorkspaceStore((state) => state.setWorkspaceRole);
  const setCustomPermissions = useWorkspaceStore((state) => state.setCustomPermissions);
  const setWorkspacePermissionsReady = useWorkspaceStore(
    (state) => state.setWorkspacePermissionsReady
  );
  const isWorkspacePermissionsReady = useWorkspaceStore(
    (state) => state.isWorkspacePermissionsReady
  );
  const setIsOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.setIsOwnWorkspaceContext
  );
  const setGhostMode = useWorkspaceStore((state) => state.setGhostMode);
  const ghostModeUserId = useWorkspaceStore((state) => state.ghostModeUserId);
  const subscriptionPlan = useWorkspaceStore((state) => state.subscriptionPlan);
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);
  const isOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.isOwnWorkspaceContext
  );
  const ledgerCount = useWorkspaceStore((state) => state.ledgerCount);
  const walletRefreshKey = useWorkspaceStore((state) => state.walletRefreshKey);
  const userRefreshKey = useWorkspaceStore((state) => state.userRefreshKey);
  const [loadError, setLoadError] = useState("");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [multiWorkspaceToast, setMultiWorkspaceToast] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [isDashboardReady, setIsDashboardReady] = useState(false);
  const hasBootstrapped = useRef(false);

  useEffect(() => {
    const impersonateUserId = searchParams.get("impersonate")?.trim() || null;

    if (impersonateUserId) {
      setGhostMode(impersonateUserId, null);
    }
  }, [searchParams, setGhostMode]);

  useLayoutEffect(() => {
    const actorUserId = getActorUserIdFromDocument();

    if (!actorUserId) {
      return;
    }

    const restored = restoreWorkspaceContextFromCookies(actorUserId);

    setIsOwnWorkspaceContext(restored.isOwnWorkspace);

    if (restored.businessId) {
      setActiveBusinessId(restored.businessId);
      setMode("business");
    } else if (restored.isOwnWorkspace) {
      setMode("personal");
      setActiveBusinessId(null);
    }
  }, [
    setActiveBusinessId,
    setIsOwnWorkspaceContext,
    setMode,
  ]);

  useEffect(() => {
    if (!isWorkspacePermissionsReady) {
      return;
    }

    const navContext = {
      isOwnWorkspaceContext,
      role: workspaceRole,
      permissions: customPermissions,
    };

    if (
      (pathname === "/dashboard" || pathname === "/dashboard/") &&
      !canAccessDashboardHome(navContext)
    ) {
      router.replace("/dashboard/vendors");
      return;
    }

    if (
      (pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/")) &&
      !canAccessSettingsArea(navContext)
    ) {
      router.replace("/dashboard/vendors");
      return;
    }

    if (
      (pathname === "/dashboard/billing" || pathname.startsWith("/dashboard/billing/")) &&
      !canAccessBillingNav(navContext)
    ) {
      router.replace("/dashboard/vendors");
      return;
    }

    if (
      (pathname === "/dashboard/import" || pathname.startsWith("/dashboard/import/")) &&
      !canAccessImportNav(navContext)
    ) {
      router.replace("/dashboard/vendors");
    }
  }, [
    customPermissions,
    isOwnWorkspaceContext,
    isWorkspacePermissionsReady,
    pathname,
    router,
    workspaceRole,
  ]);

  const loadDashboardData = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      if (hasBootstrapped.current) {
        invalidateDashboardCache("dashboard-session");
      }

      const session = await fetchDashboardSession();
      const roleContext = session.role;
      const currentUser = session.user;
      const accessible = {
        options: session.accessible_workspaces,
        unique_workspace_count: session.unique_workspace_count,
      };
      const businesses = session.businesses;

      setAppRoleCookie(roleContext.role);
      setWorkspaceRole(roleContext.role);
      setCustomPermissions(roleContext.custom_permissions);
      setWorkspacePermissionsReady(true);
      setAccessibleWorkspaces(accessible.options);

      if (roleContext.role === "field_staff") {
        router.replace(getPostLoginRoute(roleContext.role));
        return;
      }
      setActorUserCookie(currentUser.id);

      if (currentUser.account_status === "suspended") {
        router.replace("/account-suspended");
        return;
      }

      if (currentUser.account_status === "pending_purge") {
        router.replace("/account-pending-purge");
        return;
      }

      let cookies = getWorkspaceCookiesFromDocument();
      const ownOption =
        accessible.options.find((option) => option.is_own_workspace) ?? null;

      if (!cookies.workspaceUserId && ownOption) {
        setWorkspaceCookies(
          ownOption.workspace_user_id,
          ownOption.business_id || null
        );
        cookies = getWorkspaceCookiesFromDocument();
      }

      const isOwnContext =
        !cookies.workspaceUserId || cookies.workspaceUserId === currentUser.id;
      setIsOwnWorkspaceContext(isOwnContext);

      setBusinesses(businesses);

      if (isOwnContext) {
        if (
          cookies.businessId &&
          businesses.some((business) => business.id === cookies.businessId)
        ) {
          setActiveBusinessId(cookies.businessId);
          setMode("business");
        } else if (businesses[0]) {
          setActiveBusinessId(businesses[0].id);
          setMode("business");
          setWorkspaceCookies(currentUser.id, businesses[0].id);
        } else {
          setActiveBusinessId(null);
          setMode("personal");
          setWorkspaceCookies(currentUser.id, null);
        }
      } else {
        setMode("business");

        if (
          cookies.businessId &&
          businesses.some((business) => business.id === cookies.businessId)
        ) {
          setActiveBusinessId(cookies.businessId);
        } else if (businesses[0] && cookies.workspaceUserId) {
          setActiveBusinessId(businesses[0].id);
          setWorkspaceCookies(cookies.workspaceUserId, businesses[0].id);
        } else {
          setActiveBusinessId(null);
        }
      }

      if (accessible.options.length > 1 && !hasShownMultiWorkspaceToast()) {
        setMultiWorkspaceToast(true);
        markMultiWorkspaceToastShown();
      }

      setWalletBalance(Number(currentUser.vapi_wallet_balance));
      setUserBillingState(
        currentUser.subscription_plan,
        currentUser.ledger_count,
        currentUser.is_super_admin
      );
      setLoadError("");
      setIsDashboardReady(true);
    } catch (error) {
      if (error instanceof AccountSuspendedError) {
        router.replace("/account-suspended");
        return;
      }

      if (error instanceof AccountPendingPurgeError) {
        router.replace("/account-pending-purge");
        return;
      }

      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load dashboard data."
      );
      setWorkspacePermissionsReady(true);
      setIsDashboardReady(true);
    }
  }, [
    router,
    setActiveBusinessId,
    setBusinesses,
    setMode,
    setUserBillingState,
    setWorkspaceRole,
    setCustomPermissions,
    setWorkspacePermissionsReady,
    setIsOwnWorkspaceContext,
    setAccessibleWorkspaces,
    user,
  ]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    const shouldGate = !hasBootstrapped.current;

    if (shouldGate) {
      setIsDashboardReady(false);
      setWorkspacePermissionsReady(false);
    }

    void loadDashboardData().then(() => {
      hasBootstrapped.current = true;
    });
  }, [
    isAuthReady,
    user,
    router,
    loadDashboardData,
    walletRefreshKey,
    userRefreshKey,
    ghostModeUserId,
    dashboardRefreshKey,
    setWorkspacePermissionsReady,
  ]);

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

  if (!isAuthReady && !hasSessionHint) {
    return <AuthLoadingScreen />;
  }

  if (isAuthReady && !user) {
    return <AuthLoadingScreen />;
  }

  if (
    !hasSessionHint &&
    (!isDashboardReady || !isWorkspacePermissionsReady)
  ) {
    return <AuthLoadingScreen />;
  }

  const navContext = {
    isOwnWorkspaceContext,
    role: workspaceRole,
    permissions: customPermissions,
  };

  return (
    <div className="min-h-screen bg-recoverpe-white">
      <GhostModeBanner />
      <AssignedPartnerBanner />
      <div className="flex min-h-screen">
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-recoverpe-grey-light px-6 py-5 sm:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-5">
              <div className="grid grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)_minmax(0,1fr)]">
                <div className="flex items-center gap-3 lg:hidden">
                  <Link
                    href="/dashboard"
                    className="text-sm font-semibold text-recoverpe-black"
                  >
                    Recoverpe
                  </Link>
                  <span className="type-eyebrow rounded-md border border-recoverpe-grey-light px-2.5 py-1">
                    {subscriptionPlan === "premium" ? "Premium" : "Free"}
                  </span>
                </div>

                <div className="hidden lg:block" />

                <div className="mx-auto w-full max-w-xl justify-self-center">
                  {canAccessDashboardHome(navContext) ? <GlobalSearch /> : null}
                </div>

                <div className="flex items-center justify-end gap-3 justify-self-end">
                  <WorkspaceInvitationsInbox
                    onInvitationChange={() =>
                      setDashboardRefreshKey((current) => current + 1)
                    }
                  />
                  <div className="rounded-md border border-recoverpe-grey-light px-4 py-3 text-right">
                    <p className="type-eyebrow">AI Credits</p>
                    <p className="type-data-primary mt-1 text-base">
                      {walletBalance === null
                        ? "—"
                        : `${formatWalletCredits(walletBalance)} left`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleNewEntry}
                    disabled={
                      Boolean(ghostModeUserId) ||
                      !canMutateLedgers(workspaceRole, customPermissions)
                    }
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

          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 pb-44 sm:px-8 sm:pb-8">
            <div className="mb-6">
              <AutopilotAlerts />
            </div>
            {children}
          </main>
        </div>
      </div>
      <MobileDashboardNav />
      <GlobalLedgerViewHost />
      <AddBusinessModal />
      <GlobalTransactionModal />
      <UpgradeToPremiumModal />
      {multiWorkspaceToast ? (
        <Toast
          message="You have multiple account contexts. Use the switcher to move between My Account and assigned roles."
          onClose={() => setMultiWorkspaceToast(false)}
        />
      ) : null}
    </div>
  );
}
