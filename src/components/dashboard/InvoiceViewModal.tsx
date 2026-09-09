"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LedgerLegalToolkit } from "@/components/dashboard/LedgerLegalToolkit";
import { LedgerNotes } from "@/components/dashboard/LedgerNotes";
import { Modal } from "@/components/ui/Modal";
import { getAuthHeaders } from "@/lib/businesses";
import {
  downloadDocumentFromApiRoute,
  openDocumentFromApiRoute,
  buildDocumentDownloadRoute,
} from "@/lib/pdf-download";
import { LedgerWithContact } from "@/types";

interface InvoiceViewModalProps {
  ledger: LedgerWithContact | null;
  isOpen: boolean;
  onClose: () => void;
  canViewEvidenceDocket?: boolean;
  canSpendFunds?: boolean;
  readOnly?: boolean;
  onGenerateSamadhaanKit?: (ledger: LedgerWithContact) => void;
  onViewSamadhaanKit?: (ledger: LedgerWithContact) => void;
  isGeneratingSamadhaan?: boolean;
  isViewingSamadhaan?: boolean;
  gateLegalDocuments?: boolean;
  onProfileIncomplete?: () => void;
}

export function InvoiceViewModal({
  ledger,
  isOpen,
  onClose,
  canViewEvidenceDocket = false,
  canSpendFunds = false,
  readOnly = false,
  onGenerateSamadhaanKit,
  onViewSamadhaanKit,
  isGeneratingSamadhaan = false,
  isViewingSamadhaan = false,
  gateLegalDocuments = false,
  onProfileIncomplete,
}: InvoiceViewModalProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  if (!ledger?.pdf_url || !isOpen) {
    return null;
  }

  const ledgerId = ledger.id;
  const downloadRoute = buildDocumentDownloadRoute("invoice", ledgerId);
  const requiresLegalProfile = gateLegalDocuments && !ledger.is_custom_pdf;

  function handleProfileGate(action: () => void) {
    if (requiresLegalProfile && onProfileIncomplete) {
      onProfileIncomplete();
      return;
    }

    action();
  }

  async function handleOpen() {
    setError("");
    setIsOpening(true);

    try {
      const headers = await getAuthHeaders();
      await openDocumentFromApiRoute(downloadRoute, headers);
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : "Failed to open PDF."
      );
    } finally {
      setIsOpening(false);
    }
  }

  async function handleDownload() {
    setError("");
    setIsDownloading(true);

    try {
      const headers = await getAuthHeaders();
      await downloadDocumentFromApiRoute(
        "invoice",
        ledgerId,
        `invoice-${ledgerId}.pdf`,
        headers
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download PDF."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ledger.is_custom_pdf ? "Custom Invoice PDF" : "Tax Invoice"}
      bodyClassName="max-h-[80vh]"
    >
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-grey-medium">
          {ledger.is_custom_pdf ? "Custom PDF" : "Invoice"} for {ledger.contact.name}
          {ledger.invoice_number ? ` (${ledger.invoice_number})` : ""}.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => handleProfileGate(() => void handleOpen())}
            disabled={isOpening || isDownloading}
          >
            {isOpening ? "Opening..." : "Open PDF"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => handleProfileGate(() => void handleDownload())}
            disabled={isOpening || isDownloading}
          >
            {isDownloading ? "Downloading..." : "Download Tax Invoice PDF"}
          </Button>
        </div>
        <LedgerLegalToolkit
          ledger={ledger}
          canViewEvidenceDocket={canViewEvidenceDocket}
          canSpendFunds={canSpendFunds}
          readOnly={readOnly}
          onGenerateSamadhaanKit={
            onGenerateSamadhaanKit
              ? (targetLedger) =>
                  handleProfileGate(() => onGenerateSamadhaanKit(targetLedger))
              : undefined
          }
          onViewSamadhaanKit={
            onViewSamadhaanKit
              ? (targetLedger) =>
                  handleProfileGate(() => onViewSamadhaanKit(targetLedger))
              : undefined
          }
          isGeneratingSamadhaan={isGeneratingSamadhaan}
          isViewingSamadhaan={isViewingSamadhaan}
        />
        <LedgerNotes ledgerId={ledger.id} compact />
        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
