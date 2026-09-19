"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getAuthHeaders } from "@/lib/auth-headers";
import { clearGhostModeCookie } from "@/lib/ghost-mode";
import { useWorkspaceStore } from "@/store/workspace-store";

export function GhostModeBanner() {
  const ghostModeUserEmail = useWorkspaceStore((state) => state.ghostModeUserEmail);
  const ghostModeUserId = useWorkspaceStore((state) => state.ghostModeUserId);
  const clearGhostMode = useWorkspaceStore((state) => state.clearGhostMode);
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);
  const bumpUserRefresh = useWorkspaceStore((state) => state.bumpUserRefresh);
  const [isExiting, setIsExiting] = useState(false);

  if (!ghostModeUserId) {
    return null;
  }

  async function handleExitGhostMode() {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    clearGhostMode();
    clearGhostModeCookie();
    bumpLedgerRefresh();
    bumpUserRefresh();

    try {
      const headers = await getAuthHeaders();
      await fetch("/api/admin/exit-ghost", {
        method: "POST",
        headers,
      });
    } catch (error) {
      console.error("[GhostModeBanner] Failed to clear server ghost session:", error);
    }

    window.location.assign("/admin");
  }

  return (
    <div className="border-b border-recoverpe-black bg-recoverpe-black px-4 py-3 text-recoverpe-white sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">
          GHOST MODE: Viewing as {ghostModeUserEmail ?? "selected user"}.
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleExitGhostMode()}
          disabled={isExiting}
          className="border-recoverpe-white bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light hover:border-recoverpe-grey-light"
        >
          {isExiting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Exiting…
            </>
          ) : (
            "Exit Ghost Mode"
          )}
        </Button>
      </div>
    </div>
  );
}
