"use client";

import { pdf } from "@react-pdf/renderer";
import { useEffect, useMemo, useState } from "react";
import { EditableInvoicePreview } from "@/components/invoices/EditableInvoicePreview";
import { ThemedInvoicePDF } from "@/components/pdf/ThemedInvoicePDF";
import { LedgerLegalToolkit } from "@/components/dashboard/LedgerLegalToolkit";
import { LedgerNotes } from "@/components/dashboard/LedgerNotes";
import { Button } from "@/components/ui/Button";
import { getAuthHeaders } from "@/lib/businesses";
import { calculateGstBreakdown } from "@/lib/gst";
import { formatDisplayInvoice } from "@/lib/invoice-display";
import {
  INVOICE_THEME_OPTIONS,
  InvoiceLayoutTheme,
  InvoiceLineItem,
  defaultInvoiceLineItems,
  sumInvoiceLineItems,
} from "@/lib/invoice-line-items";
import {
  downloadDocumentFromApiRoute,
  openDocumentFromApiRoute,
  buildDocumentDownloadRoute,
} from "@/lib/pdf-download";
import { generateUPIIntent, generateUPIQRCodeBase64 } from "@/lib/upi";
import { useWorkspaceStore } from "@/store/workspace-store";
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

function formatInvoiceDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
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
  const businesses = useWorkspaceStore((state) => state.businesses);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const defaultUpiVpa = useWorkspaceStore((state) => state.defaultUpiVpa);
  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ??
    businesses[0] ??
    null;

  const [theme, setTheme] = useState<InvoiceLayoutTheme>("corporate");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [isOpening, setIsOpening] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    if (!ledger) {
      return;
    }

    setLineItems(defaultInvoiceLineItems(ledger.total_amount));
    setTheme("corporate");
    setError("");
    setShowRecovery(false);
  }, [ledger?.id, ledger?.total_amount, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const grandTotal = sumInvoiceLineItems(lineItems);
  const gstBreakdown = useMemo(
    () =>
      calculateGstBreakdown(
        grandTotal,
        activeBusiness?.gstin ?? null,
        null
      ),
    [grandTotal, activeBusiness?.gstin]
  );

  if (!ledger || !isOpen) {
    return null;
  }

  const ledgerId = ledger.id;
  const downloadRoute = buildDocumentDownloadRoute("invoice", ledgerId);
  const invoiceNumber = formatDisplayInvoice(ledger);
  const invoiceDate = formatInvoiceDate(ledger.created_at);
  const dueDate = formatInvoiceDate(ledger.due_date);
  const businessName = activeBusiness?.business_name ?? "RecoverPe merchant";

  function handleLegalAction(action: () => void) {
    if (gateLegalDocuments && onProfileIncomplete) {
      onProfileIncomplete();
      return;
    }

    action();
  }

  async function handleOpenStored() {
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

  async function handleDownloadStored() {
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

  async function handleDownloadThemed() {
    if (!ledger) {
      return;
    }

    setError("");
    setIsDownloading(true);

    try {
      let qrCodeBase64: string | null = null;
      const vpa = defaultUpiVpa?.trim();

      if (vpa) {
        const upiUri = generateUPIIntent(
          vpa,
          businessName,
          gstBreakdown.totalAmount,
          invoiceNumber
        );
        qrCodeBase64 = await generateUPIQRCodeBase64(upiUri);
      }

      const blob = await pdf(
        <ThemedInvoicePDF
          theme={theme}
          invoiceNumber={invoiceNumber}
          invoiceDate={invoiceDate}
          dueDate={dueDate}
          businessName={businessName}
          businessGstin={activeBusiness?.gstin ?? null}
          contactName={ledger.contact.name}
          contactPhone={ledger.contact.phone_number}
          clientGstin={null}
          lineItems={lineItems}
          gstBreakdown={gstBreakdown}
          qrCodeBase64={qrCodeBase64}
        />
      ).toBlob();

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${invoiceNumber.replace(/\s+/g, "-").toLowerCase()}-${theme}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F8FAFC]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-recoverpe-line bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-recoverpe-muted">
            {ledger.is_custom_pdf ? "Custom PDF" : "Invoice studio"}
          </p>
          <h2 className="truncate text-lg font-semibold text-recoverpe-black">
            {ledger.contact.name} · {invoiceNumber}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {ledger.is_custom_pdf ? (
            <>
              <Button
                type="button"
                onClick={() => void handleOpenStored()}
                disabled={isOpening || isDownloading}
              >
                {isOpening ? "Opening..." : "Open PDF"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleDownloadStored()}
                disabled={isOpening || isDownloading || !ledger.pdf_url}
              >
                {isDownloading ? "Downloading..." : "Download"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => void handleDownloadThemed()}
              disabled={isDownloading || readOnly}
            >
              {isDownloading ? "Preparing PDF..." : "Download PDF"}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </header>

      {!ledger.is_custom_pdf ? (
        <div className="shrink-0 border-b border-recoverpe-line bg-white px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-recoverpe-muted">
            Layout
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {INVOICE_THEME_OPTIONS.map((option) => {
              const selected = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    selected
                      ? "border-recoverpe-black bg-recoverpe-fill"
                      : "border-recoverpe-line bg-white hover:bg-recoverpe-fill"
                  }`}
                >
                  <span className="block font-medium text-recoverpe-black">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-recoverpe-muted">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {ledger.is_custom_pdf ? (
          <div className="mx-auto max-w-xl rounded-xl border border-recoverpe-line bg-white p-6">
            <p className="text-sm text-recoverpe-grey-medium">
              Custom PDF for {ledger.contact.name}
              {ledger.invoice_number ? ` (${ledger.invoice_number})` : ""}.
            </p>
          </div>
        ) : (
          <EditableInvoicePreview
            theme={theme}
            businessName={businessName}
            businessAddress={activeBusiness?.business_address ?? null}
            businessGstin={activeBusiness?.gstin ?? null}
            gstNotRequired={Boolean(activeBusiness?.gst_not_required)}
            contactName={ledger.contact.name}
            contactPhone={ledger.contact.phone_number}
            invoiceNumber={invoiceNumber}
            invoiceDate={invoiceDate}
            dueDate={dueDate}
            lineItems={lineItems}
            onLineItemsChange={setLineItems}
            taxableAmount={gstBreakdown.taxableAmount}
            cgst={gstBreakdown.cgst}
            sgst={gstBreakdown.sgst}
            igst={gstBreakdown.igst}
            grandTotal={gstBreakdown.totalAmount}
            documentTitle={
              gstBreakdown.documentType === "tax_invoice"
                ? "Tax Invoice"
                : "Bill of Supply"
            }
          />
        )}

        {ledger.pdf_url && !ledger.is_custom_pdf ? (
          <div className="mx-auto mt-4 max-w-[210mm]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleOpenStored()}
              disabled={isOpening || isDownloading}
            >
              {isOpening ? "Opening..." : "Open original PDF"}
            </Button>
          </div>
        ) : null}

        <div className="mx-auto mt-8 max-w-[210mm] border-t border-recoverpe-line pt-4">
          <button
            type="button"
            className="text-sm font-medium text-recoverpe-black"
            onClick={() => setShowRecovery((open) => !open)}
          >
            {showRecovery ? "Hide recovery tools" : "Recovery tools & notes"}
          </button>
          {showRecovery ? (
            <div className="mt-4 space-y-4">
              <LedgerLegalToolkit
                ledger={ledger}
                canViewEvidenceDocket={canViewEvidenceDocket}
                canSpendFunds={canSpendFunds}
                readOnly={readOnly}
                onGenerateSamadhaanKit={
                  onGenerateSamadhaanKit
                    ? (targetLedger) =>
                        handleLegalAction(() => onGenerateSamadhaanKit(targetLedger))
                    : undefined
                }
                onViewSamadhaanKit={
                  onViewSamadhaanKit
                    ? (targetLedger) =>
                        handleLegalAction(() => onViewSamadhaanKit(targetLedger))
                    : undefined
                }
                isGeneratingSamadhaan={isGeneratingSamadhaan}
                isViewingSamadhaan={isViewingSamadhaan}
              />
              <LedgerNotes ledgerId={ledger.id} compact />
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="mx-auto mt-4 max-w-[210mm] text-sm text-recoverpe-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
