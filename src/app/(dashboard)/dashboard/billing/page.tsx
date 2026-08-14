"use client";

import { useCallback, useEffect, useState } from "react";
import { BillingView } from "@/components/billing/BillingView";
import { fetchCurrentUser } from "@/lib/users";
import { useWorkspaceStore } from "@/store/workspace-store";
import { RecoverpeUser } from "@/types";

export default function BillingPage() {
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
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load billing profile."
      );
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [setUserBillingState]);

  useEffect(() => {
    void loadUser();
  }, [loadUser, userRefreshKey, walletRefreshKey]);

  if (isLoading) {
    return (
      <p className="text-sm text-recoverpe-grey-medium">Loading billing details...</p>
    );
  }

  if (error || !user) {
    return <p className="text-sm text-recoverpe-error">{error || "Unable to load billing."}</p>;
  }

  return <BillingView user={user} />;
}
