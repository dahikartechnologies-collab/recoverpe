"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PURCHASE_PRODUCTS } from "@/lib/razorpay-products";
import { LedgerWithContact, PurchaseType } from "@/types";

type MicroPurchaseType = Extract<
  PurchaseType,
  "legal_notice_999" | "samadhaan_499"
>;

interface MicroTransactionConfirmModalProps {
  ledger: LedgerWithContact | null;
  purchaseType: MicroPurchaseType | null;
  isOpen: boolean;
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const CONFIRM_COPY: Record<
  MicroPurchaseType,
  { title: string; summary: string; bullets: string[] }
> = {
  legal_notice_999: {
    title: "Issue Formal Legal Notice",
    summary:
      "Generate a court-ready demand notice drafted under the Negotiable Instruments Act and MSME Development Act, on advocate letterhead.",
    bullets: [
      "Formal PDF on Adv. Anil D. Kamble letterhead with numbered legal clauses",
      "Overdue breakdown, 7-day settlement ultimatum, and signature block",
      "Instant download plus optional WhatsApp dispatch to the debtor",
      "One-time document fee — no subscription required",
    ],
  },
  samadhaan_499: {
    title: "Generate MSME Samadhaan Smart-Kit",
    summary:
      "Compile an evidence docket and filing guide to support your delayed-payment application on the official Samadhaan portal.",
    bullets: [
      "Multi-page Evidence Docket PDF with invoice metadata and reminder timeline",
      "One-click copy fields for GSTINs, invoice number, date, and outstanding amount",
      "Direct portal link and a 5-step filing checklist",
      "One-time kit fee — generated instantly after payment",
    ],
  },
};

export function MicroTransactionConfirmModal({
  ledger,
  purchaseType,
  isOpen,
  isProcessing,
  onClose,
  onConfirm,
}: MicroTransactionConfirmModalProps) {
  if (!ledger || !purchaseType) {
    return null;
  }

  const product = PURCHASE_PRODUCTS[purchaseType];
  const copy = CONFIRM_COPY[purchaseType];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={copy.title}
      bodyClassName="max-h-[80vh] overflow-y-auto"
      disableClose={isProcessing}
    >
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-grey-medium">{copy.summary}</p>

        <div className="rounded-md border border-recoverpe-grey-light px-4 py-3">
          <p className="text-sm font-medium text-recoverpe-black">
            {ledger.contact.name}
          </p>
          <p className="mt-1 text-xs text-recoverpe-grey-medium">
            Outstanding balance due on this ledger entry
          </p>
        </div>

        <ul className="list-disc space-y-2 pl-5 text-sm text-recoverpe-black">
          {copy.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>

        <p className="text-xs text-recoverpe-grey-medium">
          Why is this paid? Recoverpe covers advocate drafting, PDF generation, secure
          storage, and delivery infrastructure for each one-time legal document.
        </p>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isProcessing}>
            {isProcessing
              ? "Processing Payment..."
              : `Pay ${product.amountLabel} & Generate`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
