"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LedgerWithContact } from "@/types";

interface InvoiceViewModalProps {
  ledger: LedgerWithContact | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InvoiceViewModal({
  ledger,
  isOpen,
  onClose,
}: InvoiceViewModalProps) {
  if (!ledger?.pdf_url) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tax Invoice">
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-grey-medium">
          Invoice for {ledger.contact.name}
          {ledger.invoice_number ? ` (${ledger.invoice_number})` : ""}.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href={ledger.pdf_url} target="_blank" rel="noopener noreferrer">
            <Button className="w-full sm:w-auto">Open PDF</Button>
          </a>
          <a href={ledger.pdf_url} download>
            <Button variant="secondary" className="w-full sm:w-auto">
              Download PDF
            </Button>
          </a>
        </div>
      </div>
    </Modal>
  );
}
