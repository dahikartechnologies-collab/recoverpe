"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/gst";
import { PURCHASE_PRODUCTS } from "@/lib/razorpay-products";
import { AutopilotEscalationAlert } from "@/types";

interface LegalNoticePreviewModalProps {
  alert: AutopilotEscalationAlert | null;
  isOpen: boolean;
  isProcessing: boolean;
  onClose: () => void;
  onGenerate: () => void;
}

export function LegalNoticePreviewModal({
  alert,
  isOpen,
  isProcessing,
  onClose,
  onGenerate,
}: LegalNoticePreviewModalProps) {
  if (!alert || !isOpen) {
    return null;
  }

  const product = PURCHASE_PRODUCTS.legal_notice_999;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Legal Escalation Ready"
      disableClose={isProcessing}
    >
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-recoverpe-grey-medium">
          Recovery Autopilot has completed its final warning for{" "}
          <span className="font-semibold text-recoverpe-black">
            {alert.contact_name}
          </span>
          . Issue a formal demand notice on advocate letterhead to escalate
          collection.
        </p>

        <div className="rounded-md border border-recoverpe-grey-light px-4 py-3 text-sm">
          <p className="font-medium text-recoverpe-black">
            {alert.invoice_number ?? "Open invoice"}
          </p>
          <p className="mt-1 text-recoverpe-grey-medium">
            Outstanding: {formatCurrency(alert.balance_due)} · Due {alert.due_date}
          </p>
        </div>

        <ul className="list-disc space-y-1 pl-5 text-sm text-recoverpe-grey-medium">
          <li>Court-ready PDF under the Negotiable Instruments Act</li>
          <li>7-day settlement ultimatum with advocate signature block</li>
          <li>Instant download and optional WhatsApp dispatch</li>
        </ul>

        <Button
          type="button"
          className="h-12 w-full text-base font-semibold"
          onClick={onGenerate}
          disabled={isProcessing}
        >
          {isProcessing
            ? "Processing payment..."
            : `Generate & Send Official Notice - ${product.amountLabel}`}
        </Button>
      </div>
    </Modal>
  );
}
