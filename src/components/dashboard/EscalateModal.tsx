"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/gst";
import { WallOfShameEntry } from "@/lib/dashboard-intelligence-client";

interface EscalateModalProps {
  entry: WallOfShameEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSendWhatsApp: (ledgerId: string) => Promise<void>;
  onInitiateAiCall: (ledgerId: string) => Promise<void>;
  isSendingWhatsApp?: boolean;
  isCalling?: boolean;
}

export function EscalateModal({
  entry,
  isOpen,
  onClose,
  onSendWhatsApp,
  onInitiateAiCall,
  isSendingWhatsApp = false,
  isCalling = false,
}: EscalateModalProps) {
  const [error, setError] = useState("");

  if (!entry) {
    return null;
  }

  async function handleWhatsApp() {
    setError("");

    try {
      await onSendWhatsApp(entry!.ledger_id);
      onClose();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send WhatsApp warning."
      );
    }
  }

  async function handleAiCall() {
    setError("");

    try {
      await onInitiateAiCall(entry!.ledger_id);
      onClose();
    } catch (callError) {
      setError(
        callError instanceof Error
          ? callError.message
          : "Failed to initiate AI call."
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Escalate Collection">
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-grey-medium">
          Send an immediate warning to{" "}
          <span className="font-medium text-recoverpe-black">
            {entry.contact_name}
          </span>{" "}
          for {formatCurrency(entry.balance_due)} overdue by {entry.days_overdue}{" "}
          day(s).
        </p>

        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleWhatsApp()}
            disabled={isSendingWhatsApp || isCalling}
          >
            {isSendingWhatsApp ? "Sending..." : "WhatsApp Warning"}
          </Button>
          <Button
            type="button"
            onClick={() => void handleAiCall()}
            disabled={isSendingWhatsApp || isCalling}
          >
            {isCalling ? "Calling..." : "AI Call Now"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
