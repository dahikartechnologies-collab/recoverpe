"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BillingView } from "@/components/billing/BillingView";
import { Skeleton } from "@/components/ui/Skeleton";
import { AccountPendingPurgeError, AccountSuspendedError, fetchCurrentUser } from "@/lib/users";
import { useWorkspaceStore } from "@/store/workspace-store";
import { RecoverpeUser } from "@/types";

export default function BillingPage() {
  const router = useRouter();
  const userRefreshKey = useWorkspaceStore((state) => state.userRefreshKey);
  const walletRefreshKey = useWorkspaceStore((state) => state.walletRefreshKey);
  const setUserBillingState = useWorkspaceStore((state) => state.setUserBillingState);
  const [user, setUser] = useState<RecoverpeUser | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const profile = await fetchCurrentUser();
      setUser(profile);
      setUserBillingState(profile.subscription_plan, profile.ledger_count);
    } catch (loadError) {
      if (loadError instanceof AccountSuspendedError) {
        router.replace("/account-suspended");
        return;
      }

      if (loadError instanceof AccountPendingPurgeError) {
        router.replace("/account-pending-purge");
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load billing profile."
      );
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [router, setUserBillingState]);

  useEffect(() => {
    void loadUser();
  }, [loadUser, userRefreshKey, walletRefreshKey]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !user) {
    return <p className="text-sm text-recoverpe-error">{error || "Unable to load billing."}</p>;
  }

  return <BillingView user={user} />;
}
