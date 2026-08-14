"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useWorkspaceStore } from "@/store/workspace-store";

export function GhostModeBanner() {
  const router = useRouter();
  const ghostModeUserEmail = useWorkspaceStore((state) => state.ghostModeUserEmail);
  const ghostModeUserId = useWorkspaceStore((state) => state.ghostModeUserId);
  const clearGhostMode = useWorkspaceStore((state) => state.clearGhostMode);
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);
  const bumpUserRefresh = useWorkspaceStore((state) => state.bumpUserRefresh);

  if (!ghostModeUserId) {
    return null;
  }

  function handleExitGhostMode() {
    clearGhostMode();
    bumpLedgerRefresh();
    bumpUserRefresh();
    router.replace("/dashboard");
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
          onClick={handleExitGhostMode}
          className="border-recoverpe-white bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light hover:border-recoverpe-grey-light"
        >
          Exit Ghost Mode
        </Button>
      </div>
    </div>
  );
}
