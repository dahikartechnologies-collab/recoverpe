"use client";

import { pdf } from "@react-pdf/renderer";
import { useEffect, useMemo, useState } from "react";
import { EditableInvoicePreview } from "@/components/invoices/EditableInvoicePreview";
import { ThemedInvoicePDF } from "@/components/pdf/ThemedInvoicePDF";
import { LedgerLegalToolkit } from "@/components/dashboard/LedgerLegalToolkit";
import { LedgerNotes } from "@/components/dashboard/LedgerNotes";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getAuthHeaders } from "@/lib/businesses";
import { calculateGstBreakdown } from "@/lib/gst";
import { formatDisplayInvoice } from "@/lib/invoice-display";
import {
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

  useEffect(() => {
    if (!ledger) {
      return;
    }

    setLineItems(defaultInvoiceLineItems(ledger.total_amount));
    setTheme("corporate");
    setError("");
  }, [ledger?.id, ledger?.total_amount, isOpen]);

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
  const requiresLegalProfile = gateLegalDocuments && !ledger.is_custom_pdf;
  const invoiceNumber = formatDisplayInvoice(ledger);
  const invoiceDate = formatInvoiceDate(ledger.created_at);
  const dueDate = formatInvoiceDate(ledger.due_date);
  const businessName = activeBusiness?.business_name ?? "RecoverPe merchant";

  function handleProfileGate(action: () => void) {
    if (requiresLegalProfile && onProfileIncomplete) {
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ledger.is_custom_pdf ? "Custom Invoice PDF" : "Invoice builder"}
      panelClassName="max-w-4xl"
      bodyClassName="max-h-[80vh]"
    >
      <div className="space-y-4">
        {ledger.is_custom_pdf ? (
          <>
            <p className="text-sm text-recoverpe-grey-medium">
              Custom PDF for {ledger.contact.name}
              {ledger.invoice_number ? ` (${ledger.invoice_number})` : ""}.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => handleProfileGate(() => void handleOpenStored())}
                disabled={isOpening || isDownloading}
              >
                {isOpening ? "Opening..." : "Open PDF"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => handleProfileGate(() => void handleDownloadStored())}
                disabled={isOpening || isDownloading || !ledger.pdf_url}
              >
                {isDownloading ? "Downloading..." : "Download Tax Invoice PDF"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <EditableInvoicePreview
              theme={theme}
              onThemeChange={setTheme}
              businessName={businessName}
              businessGstin={activeBusiness?.gstin ?? null}
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
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() => handleProfileGate(() => void handleDownloadThemed())}
                disabled={isDownloading || readOnly}
              >
                {isDownloading ? "Preparing PDF..." : "Download PDF"}
              </Button>
              {ledger.pdf_url ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleProfileGate(() => void handleOpenStored())}
                  disabled={isOpening || isDownloading}
                >
                  {isOpening ? "Opening..." : "Open original PDF"}
                </Button>
              ) : null}
            </div>
          </>
        )}
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
