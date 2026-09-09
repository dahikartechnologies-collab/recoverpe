"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getAuthHeaders } from "@/lib/businesses";
import { downloadDocumentFromApiRoute } from "@/lib/pdf-download";
import { MicroTransactionFulfillment } from "@/types";

interface LegalNoticeSuccessModalProps {
  fulfillment: MicroTransactionFulfillment | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LegalNoticeSuccessModal({
  fulfillment,
  isOpen,
  onClose,
}: LegalNoticeSuccessModalProps) {
  const [isSending, setIsSending] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!fulfillment || !isOpen) {
    return null;
  }

  const ledgerId = fulfillment.ledger_id;

  async function handleDownload() {
    setError("");
    setIsDownloading(true);

    try {
      const headers = await getAuthHeaders();
      await downloadDocumentFromApiRoute(
        "legal-notice",
        ledgerId,
        `legal-notice-${ledgerId}.pdf`,
        headers
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download legal notice PDF."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleSendWhatsApp() {
    setError("");
    setMessage("");
    setIsSending(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/messages/send-legal-notice", {
        method: "POST",
        headers,
        body: JSON.stringify({ ledger_id: ledgerId }),
      });

      const body = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Failed to send legal notice via WhatsApp.");
      }

      setMessage(
        body.message ??
          "Legal notice dispatched via WhatsApp (simulated in development)."
      );
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send legal notice via WhatsApp."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Legal Notice Ready">
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-grey-medium">
          Your formal demand notice under the Negotiable Instruments Act has been
          generated on Adv. Anil D. Kamble letterhead. Download it now or send it
          directly to the debtor via WhatsApp.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void handleDownload()}
            disabled={isDownloading}
          >
            {isDownloading ? "Preparing PDF..." : "Download Legal Notice PDF"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => void handleSendWhatsApp()}
            disabled={isSending}
          >
            {isSending ? "Sending..." : "Send via WhatsApp"}
          </Button>
        </div>

        {message ? <p className="text-sm text-recoverpe-success">{message}</p> : null}
        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
