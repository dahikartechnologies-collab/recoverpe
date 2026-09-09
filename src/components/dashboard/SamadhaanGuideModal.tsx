"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getAuthHeaders } from "@/lib/businesses";
import { formatCurrency } from "@/lib/gst";
import { downloadDocumentFromApiRoute } from "@/lib/pdf-download";
import { MicroTransactionFulfillment } from "@/types";

interface SamadhaanGuideModalProps {
  fulfillment: MicroTransactionFulfillment | null;
  isOpen: boolean;
  onClose: () => void;
}

interface CopyFieldProps {
  label: string;
  value: string;
  copyValue?: string;
}

function CopyField({ label, value, copyValue }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyValue ?? value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-md border border-recoverpe-grey-light px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-recoverpe-grey-medium">{label}</p>
          <p className="mt-0.5 break-all text-sm text-recoverpe-black">{value}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="shrink-0 rounded border border-recoverpe-black px-2 py-1 text-xs font-medium text-recoverpe-black hover:bg-recoverpe-grey-light"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const FILING_STEPS = [
  "Open the official MSME Samadhaan portal and sign in with your Udyam / GST credentials.",
  "Select “File an Application” and choose the delayed payment category.",
  "Paste the copied Claimant GSTIN, Debtor GSTIN, invoice number, invoice date, and outstanding amount.",
  "Upload the Evidence Docket PDF as supporting documentation.",
  "Review the application summary and submit. Retain the acknowledgement reference.",
];

export function SamadhaanGuideModal({
  fulfillment,
  isOpen,
  onClose,
}: SamadhaanGuideModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  if (!fulfillment?.samadhaan_meta || !isOpen) {
    return null;
  }

  const meta = fulfillment.samadhaan_meta;
  const ledgerId = fulfillment.ledger_id;

  async function handleDownloadDocket() {
    setDownloadError("");
    setIsDownloading(true);

    try {
      const headers = await getAuthHeaders();
      await downloadDocumentFromApiRoute(
        "samadhaan-docket",
        ledgerId,
        `samadhaan-docket-${ledgerId}.pdf`,
        headers
      );
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Failed to download Evidence Docket PDF."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="MSME Samadhaan Smart-Kit"
      bodyClassName="max-h-[80vh]"
    >
      <div className="space-y-5">
        <p className="text-sm text-recoverpe-grey-medium">
          Your evidence docket is ready. Use the portal link and one-click copy
          fields below to complete filing on the government site.
        </p>

        <a
          href="https://samadhaan.msme.gov.in/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button className="w-full sm:w-auto">Open samadhaan.msme.gov.in</Button>
        </a>

        <div className="space-y-2">
          <CopyField
            label="Claimant GSTIN"
            value={meta.claimant_gstin || "Not on file — add in business settings"}
            copyValue={meta.claimant_gstin ?? ""}
          />
          <CopyField
            label="Debtor GSTIN"
            value={meta.debtor_gstin || "Not on file — add to contact profile"}
            copyValue={meta.debtor_gstin ?? ""}
          />
          <CopyField
            label="Invoice Number"
            value={meta.invoice_number || "Not assigned"}
            copyValue={meta.invoice_number ?? ""}
          />
          <CopyField label="Invoice Date" value={meta.invoice_date} />
          <CopyField
            label="Total Outstanding Amount"
            value={formatCurrency(meta.balance_due)}
            copyValue={String(meta.balance_due)}
          />
        </div>

        <div className="rounded-md border border-recoverpe-grey-light">
          <div className="border-b border-recoverpe-grey-light px-3 py-2">
            <p className="text-sm font-medium text-recoverpe-black">
              Filing checklist
            </p>
          </div>
          <ol className="list-decimal space-y-2 px-5 py-3 text-sm text-recoverpe-black">
            {FILING_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => void handleDownloadDocket()}
          disabled={isDownloading}
        >
          {isDownloading ? "Preparing PDF..." : "Download Evidence Docket PDF"}
        </Button>

        {downloadError ? (
          <p className="text-sm text-recoverpe-error">{downloadError}</p>
        ) : null}
      </div>
    </Modal>
  );
}
