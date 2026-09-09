"use client";

import { ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { KioskAuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { logout } from "@/lib/auth";
import {
  clearAppRoleCookie,
  fetchWorkspaceRole,
  setAppRoleCookie,
} from "@/lib/kiosk-client";
import {
  clearWorkspaceCookies,
  restoreWorkspaceContextFromCookies,
} from "@/lib/workspace-context";

interface KioskShellProps {
  children: ReactNode;
}

export function KioskShell({ children }: KioskShellProps) {
  const router = useRouter();
  const { user, isAuthReady } = useAuth();
  const [isKioskReady, setIsKioskReady] = useState(false);
  const [businessName, setBusinessName] = useState("Assigned route");

  useLayoutEffect(() => {
    if (!user) {
      return;
    }

    const restored = restoreWorkspaceContextFromCookies(user.uid);

    if (restored.appRole) {
      setAppRoleCookie(restored.appRole);
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    async function bootstrapKiosk() {
      try {
        const roleContext = await fetchWorkspaceRole();
        setAppRoleCookie(roleContext.role);
        setBusinessName(roleContext.business_name || "Assigned route");

        if (roleContext.role !== "field_staff") {
          router.replace("/dashboard");
          return;
        }

        setIsKioskReady(true);
      } catch {
        router.replace("/login");
      }
    }

    void bootstrapKiosk();
  }, [isAuthReady, user, router]);

  async function handleLogout() {
    clearAppRoleCookie();
    clearWorkspaceCookies();
    await logout();
    router.replace("/login");
  }

  if (!isAuthReady || !isKioskReady) {
    return <KioskAuthLoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-recoverpe-white text-recoverpe-black">
      <header className="sticky top-0 z-20 border-b border-recoverpe-grey-light bg-recoverpe-white px-4 py-3">
        <div className="mx-auto max-w-lg">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-recoverpe-grey-medium">
            Field Collection
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <WorkspaceSwitcher compact kiosk />
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="focus-ring shrink-0 rounded-lg border border-recoverpe-black px-3 py-2 text-xs font-semibold text-recoverpe-black transition-all duration-200 ease-out hover:bg-recoverpe-grey-light"
            >
              Log Out
            </button>
          </div>
          <p className="type-data-secondary mt-2 truncate text-xs">{businessName}</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
