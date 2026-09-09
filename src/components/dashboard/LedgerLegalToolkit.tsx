"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EvidenceVault } from "@/components/dashboard/EvidenceVault";
import {
  downloadEvidenceDocketPdf,
  openEvidenceDocketPdf,
} from "@/lib/ledger-docket-client";
import { LedgerWithContact } from "@/types";

interface LedgerLegalToolkitProps {
  ledger: LedgerWithContact;
  canViewEvidenceDocket: boolean;
  canSpendFunds: boolean;
  readOnly?: boolean;
  onGenerateSamadhaanKit?: (ledger: LedgerWithContact) => void;
  onViewSamadhaanKit?: (ledger: LedgerWithContact) => void;
  isGeneratingSamadhaan?: boolean;
  isViewingSamadhaan?: boolean;
  showEvidenceVault?: boolean;
}

export function LedgerLegalToolkit({
  ledger,
  canViewEvidenceDocket,
  canSpendFunds,
  readOnly = false,
  onGenerateSamadhaanKit,
  onViewSamadhaanKit,
  isGeneratingSamadhaan = false,
  isViewingSamadhaan = false,
  showEvidenceVault = true,
}: LedgerLegalToolkitProps) {
  const [isOpeningDocket, setIsOpeningDocket] = useState(false);
  const [isDownloadingDocket, setIsDownloadingDocket] = useState(false);
  const [docketError, setDocketError] = useState("");
  const hasSamadhaanKit = Boolean(ledger.samadhaan_docket_pdf_url);

  async function handleOpenEvidenceDocket() {
    setDocketError("");
    setIsOpeningDocket(true);

    try {
      await openEvidenceDocketPdf(ledger.id);
    } catch (error) {
      setDocketError(
        error instanceof Error ? error.message : "Failed to open evidence docket."
      );
    } finally {
      setIsOpeningDocket(false);
    }
  }

  async function handleDownloadEvidenceDocket() {
    setDocketError("");
    setIsDownloadingDocket(true);

    try {
      await downloadEvidenceDocketPdf(ledger.id);
    } catch (error) {
      setDocketError(
        error instanceof Error
          ? error.message
          : "Failed to download evidence docket."
      );
    } finally {
      setIsDownloadingDocket(false);
    }
  }

  const showSamadhaanGenerate =
    !hasSamadhaanKit &&
    canSpendFunds &&
    !readOnly &&
    ledger.balance_due > 0 &&
    ledger.status !== "cancelled" &&
    Boolean(onGenerateSamadhaanKit);

  const showSamadhaanView =
    hasSamadhaanKit && canViewEvidenceDocket && Boolean(onViewSamadhaanKit);

  if (
    !canViewEvidenceDocket &&
    !showSamadhaanGenerate &&
    !showSamadhaanView &&
    !showEvidenceVault
  ) {
    return null;
  }

  return (
    <div className="space-y-4 border-t border-recoverpe-grey-light pt-4">
      {canViewEvidenceDocket || showSamadhaanGenerate || showSamadhaanView ? (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-recoverpe-grey-medium">
              Legal toolkit
            </p>
            <p className="mt-1 text-xs text-recoverpe-grey-medium">
              Evidence dockets and MSME Samadhaan filing kits for this ledger.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canViewEvidenceDocket ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => void handleOpenEvidenceDocket()}
                  disabled={isOpeningDocket || isDownloadingDocket}
                >
                  {isOpeningDocket ? "Opening..." : "View Evidence Docket"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => void handleDownloadEvidenceDocket()}
                  disabled={isOpeningDocket || isDownloadingDocket}
                >
                  {isDownloadingDocket ? "Downloading..." : "Download Evidence Docket"}
                </Button>
              </>
            ) : null}

            {showSamadhaanView ? (
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => onViewSamadhaanKit?.(ledger)}
                disabled={isViewingSamadhaan}
              >
                {isViewingSamadhaan ? "Opening..." : "View Samadhaan Kit"}
              </Button>
            ) : null}

            {showSamadhaanGenerate ? (
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => onGenerateSamadhaanKit?.(ledger)}
                disabled={isGeneratingSamadhaan}
              >
                {isGeneratingSamadhaan
                  ? "Processing..."
                  : "Generate Samadhaan Kit (₹499)"}
              </Button>
            ) : null}
          </div>

          {docketError ? (
            <p className="text-sm text-recoverpe-error">{docketError}</p>
          ) : null}
        </div>
      ) : null}

      {showEvidenceVault && canViewEvidenceDocket ? (
        <EvidenceVault ledgerId={ledger.id} compact />
      ) : null}
    </div>
  );
}
