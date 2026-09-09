"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadLedgersCsv } from "@/lib/ledger-export";
import { LedgerWithContact } from "@/types";

interface ExportLedgerButtonProps {
  ledgers: LedgerWithContact[];
  filename?: string;
  disabled?: boolean;
}

export function ExportLedgerButton({
  ledgers,
  filename = "recoverpe-ledgers.csv",
  disabled = false,
}: ExportLedgerButtonProps) {
  function handleExport() {
    if (ledgers.length === 0) {
      return;
    }

    downloadLedgersCsv(ledgers, filename);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={handleExport}
      disabled={disabled || ledgers.length === 0}
      className="inline-flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  );
}
