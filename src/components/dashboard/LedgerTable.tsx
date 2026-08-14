"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { formatCurrency } from "@/lib/gst";
import {
  canInitiateAiCallForLedger,
  displayStatusClassName,
  displayStatusLabel,
  getDisplayLedgerStatus,
} from "@/lib/ledger-status";
import { LedgerWithContact } from "@/types";

interface LedgerTableProps {
  ledgers: LedgerWithContact[];
  onViewPdf: (ledger: LedgerWithContact) => void;
  onSendReminder: (ledger: LedgerWithContact) => void;
  onLogOfflinePayment: (ledger: LedgerWithContact) => void;
  onInitiateAiCall: (ledger: LedgerWithContact) => void;
  onToggleAutomationPause: (
    ledger: LedgerWithContact,
    communicationPaused: boolean
  ) => void;
  sendingLedgerId?: string | null;
  callingLedgerId?: string | null;
  togglingLedgerId?: string | null;
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function canSendReminder(ledger: LedgerWithContact): boolean {
  return (
    ledger.balance_due > 0 &&
    !["paid", "cancelled", "refunded"].includes(ledger.status) &&
    !ledger.communication_paused
  );
}

function canLogOfflinePayment(ledger: LedgerWithContact): boolean {
  return ledger.balance_due > 0 && ledger.status !== "cancelled";
}

export function LedgerTable({
  ledgers,
  onViewPdf,
  onSendReminder,
  onLogOfflinePayment,
  onInitiateAiCall,
  onToggleAutomationPause,
  sendingLedgerId = null,
  callingLedgerId = null,
  togglingLedgerId = null,
}: LedgerTableProps) {
  if (ledgers.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm font-medium text-recoverpe-black">No ledger entries yet</p>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            Use New Entry to add your first contact and amount.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-recoverpe-grey-light bg-recoverpe-grey-light">
                <th className="px-4 py-3 font-medium text-recoverpe-black">Contact</th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Amount</th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Balance Due</th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Due Date</th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Status</th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Automations</th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.map((ledger) => {
                const isSending = sendingLedgerId === ledger.id;
                const isCalling = callingLedgerId === ledger.id;
                const isToggling = togglingLedgerId === ledger.id;
                const reminderEnabled = canSendReminder(ledger);
                const offlinePaymentEnabled = canLogOfflinePayment(ledger);
                const aiCallEnabled = canInitiateAiCallForLedger(ledger);
                const automationsPaused = ledger.communication_paused;
                const displayStatus = getDisplayLedgerStatus(ledger);

                return (
                  <tr
                    key={ledger.id}
                    className="border-b border-recoverpe-grey-light last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-recoverpe-black">
                        {ledger.contact.name}
                      </p>
                      <p className="text-xs text-recoverpe-grey-medium">
                        {ledger.contact.phone_number}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-recoverpe-black">
                      {formatCurrency(ledger.total_amount)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-recoverpe-black">
                      {formatCurrency(ledger.balance_due)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-recoverpe-black">
                      {formatDueDate(ledger.due_date)}
                    </td>
                    <td
                      className={`px-4 py-3 capitalize ${displayStatusClassName(displayStatus)}`}
                    >
                      {displayStatusLabel(displayStatus)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[9rem] items-center gap-2">
                        <Toggle
                          checked={!automationsPaused}
                          onChange={(checked) =>
                            onToggleAutomationPause(ledger, !checked)
                          }
                          disabled={isToggling || ledger.status === "cancelled"}
                          label={
                            automationsPaused
                              ? "Resume automations"
                              : "Pause automations"
                          }
                        />
                        <span className="text-xs text-recoverpe-grey-medium">
                          {automationsPaused ? "Paused" : "Active"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[11rem] flex-col gap-2">
                        {reminderEnabled ? (
                          <Button
                            type="button"
                            onClick={() => onSendReminder(ledger)}
                            disabled={isSending}
                          >
                            {isSending ? "Sending..." : "Send Reminder"}
                          </Button>
                        ) : null}
                        {aiCallEnabled ? (
                          <Button
                            type="button"
                            onClick={() => onInitiateAiCall(ledger)}
                            disabled={isCalling}
                          >
                            {isCalling ? "Calling..." : "Initiate AI Call"}
                          </Button>
                        ) : null}
                        {offlinePaymentEnabled ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => onLogOfflinePayment(ledger)}
                          >
                            Log Offline Payment
                          </Button>
                        ) : null}
                        {ledger.pdf_url ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => onViewPdf(ledger)}
                          >
                            View PDF
                          </Button>
                        ) : null}
                        {!reminderEnabled &&
                        !aiCallEnabled &&
                        !offlinePaymentEnabled &&
                        !ledger.pdf_url ? (
                          <span className="text-xs text-recoverpe-grey-medium">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
