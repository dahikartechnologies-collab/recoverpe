"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onExportCsv?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onExportCsv,
  onDelete,
  isDeleting = false,
}: BulkActionBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  const actions: ReactNode[] = [];

  if (onExportCsv) {
    actions.push(
      <Button key="export" type="button" variant="secondary" onClick={onExportCsv}>
        Export CSV
      </Button>
    );
  }

  if (onDelete) {
    actions.push(
      <Button
        key="delete"
        type="button"
        variant="secondary"
        onClick={onDelete}
        disabled={isDeleting}
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </Button>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
      <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-lg border border-recoverpe-grey-light bg-recoverpe-white px-4 py-3 shadow-sm transition-all duration-200 ease-out">
        <p className="text-sm text-recoverpe-black">
          <span className="font-semibold tabular-nums">{selectedCount}</span> selected
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onClearSelection}
            className="focus-ring text-sm font-medium text-recoverpe-grey-medium transition-all duration-200 ease-out hover:text-recoverpe-black"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
