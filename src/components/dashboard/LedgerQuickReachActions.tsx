"use client";

import { MessageSquare } from "lucide-react";
import { AiVoiceCallButton } from "@/components/dashboard/AiVoiceCallButton";
import { Button } from "@/components/ui/Button";
import { canInitiateAiCallForLedger } from "@/lib/ledger-status";
import { LedgerWithContact } from "@/types";

interface LedgerQuickReachActionsProps {
  ledger: LedgerWithContact;
  readOnly?: boolean;
  canSendReminders?: boolean;
  onSendReminder: (ledger: LedgerWithContact) => void;
  isSending?: boolean;
  onToast?: (message: string, variant: "success" | "error") => void;
}

function canSendReminder(ledger: LedgerWithContact): boolean {
  return (
    ledger.balance_due > 0 &&
    !["paid", "cancelled", "refunded"].includes(ledger.status) &&
    !ledger.communication_paused
  );
}

export function LedgerQuickReachActions({
  ledger,
  readOnly = false,
  canSendReminders = true,
  onSendReminder,
  isSending = false,
  onToast,
}: LedgerQuickReachActionsProps) {
  const reminderEnabled = canSendReminder(ledger);
  const aiCallEnabled = canInitiateAiCallForLedger(ledger);

  if (readOnly || (!reminderEnabled && !aiCallEnabled)) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {reminderEnabled && canSendReminders ? (
        <Button
          type="button"
          variant="secondary"
          disabled={isSending}
          onClick={() => onSendReminder(ledger)}
          className="inline-flex items-center gap-2 px-3 py-2"
          aria-label="Send WhatsApp reminder"
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          {isSending ? "Sending…" : "WhatsApp"}
        </Button>
      ) : null}

      {aiCallEnabled ? (
        <AiVoiceCallButton
          ledgerId={ledger.id}
          contactId={ledger.contact_id}
          compact
          onSuccess={(message) => onToast?.(message, "success")}
          onError={(message) => onToast?.(message, "error")}
        />
      ) : null}
    </div>
  );
}
