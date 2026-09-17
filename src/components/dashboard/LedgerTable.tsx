"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { LedgerActionsMenu } from "@/components/dashboard/LedgerActionsMenu";
import { LedgerQuickReachActions } from "@/components/dashboard/LedgerQuickReachActions";
import { formatCurrency } from "@/lib/gst";
import { downloadLedgersCsv } from "@/lib/ledger-export";
import {
  displayStatusLabel,
  getDisplayLedgerStatus,
} from "@/lib/ledger-status";
import { LedgerPagination, LedgerWithContact } from "@/types";

interface LedgerTableProps {
  ledgers: LedgerWithContact[];
  onViewPdf: (ledger: LedgerWithContact) => void;
  onSendReminder: (ledger: LedgerWithContact) => void;
  onSendFromPhone: (ledger: LedgerWithContact) => void;
  onLogOfflinePayment: (ledger: LedgerWithContact) => void;
  onRectifyLedger?: (ledger: LedgerWithContact) => void;
  onInitiateAiCall: (ledger: LedgerWithContact) => void;
  onIssueLegalNotice?: (ledger: LedgerWithContact) => void;
  onFileSamadhaan?: (ledger: LedgerWithContact) => void;
  onDownloadLegalNotice?: (ledger: LedgerWithContact) => void;
  onViewSamadhaanDocket?: (ledger: LedgerWithContact) => void;
  onViewEvidenceDocket?: (ledger: LedgerWithContact) => void;
  onToggleAutomationPause: (
    ledger: LedgerWithContact,
    communicationPaused: boolean
  ) => void;
  sendingLedgerId?: string | null;
  callingLedgerId?: string | null;
  togglingLedgerId?: string | null;
  microTransactionLedgerId?: string | null;
  downloadingLegalNoticeLedgerId?: string | null;
  viewingSamadhaanLedgerId?: string | null;
  downloadingEvidenceDocketLedgerId?: string | null;
  readOnly?: boolean;
  canSendReminders?: boolean;
  canSpendFunds?: boolean;
  canViewEvidenceDocket?: boolean;
  onReachToast?: (message: string, variant: "success" | "error") => void;
  pagination?: LedgerPagination;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const AMOUNT_CLASS = "font-mono tabular-nums tracking-tight text-recoverpe-black";

function ledgerStatusPresentation(
  status: ReturnType<typeof getDisplayLedgerStatus>
): { tone: BadgeTone; label: string } {
  switch (status) {
    case "paid":
      return { tone: "success", label: "Paid" };
    case "overdue":
      return { tone: "danger", label: "Overdue" };
    case "pending":
      return { tone: "warning", label: "Unpaid" };
    case "partially_paid":
      return { tone: "warning", label: "Partial" };
    case "draft":
      return { tone: "neutral", label: "Draft" };
    case "cancelled":
      return { tone: "neutral", label: "Cancelled" };
    case "refunded":
      return { tone: "neutral", label: "Refunded" };
    default:
      return { tone: "neutral", label: displayStatusLabel(status) };
  }
}

function StatusBadge({ status }: { status: ReturnType<typeof getDisplayLedgerStatus> }) {
  const { tone, label } = ledgerStatusPresentation(status);
  return <Badge tone={tone}>{label}</Badge>;
}

interface LedgerActionsProps {
  ledger: LedgerWithContact;
  onViewPdf: (ledger: LedgerWithContact) => void;
  onSendReminder: (ledger: LedgerWithContact) => void;
  onSendFromPhone: (ledger: LedgerWithContact) => void;
  onLogOfflinePayment: (ledger: LedgerWithContact) => void;
  onRectifyLedger?: (ledger: LedgerWithContact) => void;
  onInitiateAiCall: (ledger: LedgerWithContact) => void;
  onIssueLegalNotice?: (ledger: LedgerWithContact) => void;
  onFileSamadhaan?: (ledger: LedgerWithContact) => void;
  onDownloadLegalNotice?: (ledger: LedgerWithContact) => void;
  onViewSamadhaanDocket?: (ledger: LedgerWithContact) => void;
  onViewEvidenceDocket?: (ledger: LedgerWithContact) => void;
  onToggleAutomationPause: (
    ledger: LedgerWithContact,
    communicationPaused: boolean
  ) => void;
  sendingLedgerId?: string | null;
  callingLedgerId?: string | null;
  togglingLedgerId?: string | null;
  microTransactionLedgerId?: string | null;
  downloadingLegalNoticeLedgerId?: string | null;
  viewingSamadhaanLedgerId?: string | null;
  downloadingEvidenceDocketLedgerId?: string | null;
  readOnly?: boolean;
  canSendReminders?: boolean;
  canSpendFunds?: boolean;
  canViewEvidenceDocket?: boolean;
  onReachToast?: (message: string, variant: "success" | "error") => void;
}

function LedgerRowActions({
  ledger,
  onViewPdf,
  onSendReminder,
  onSendFromPhone,
  onLogOfflinePayment,
  onRectifyLedger,
  onInitiateAiCall,
  onIssueLegalNotice,
  onFileSamadhaan,
  onDownloadLegalNotice,
  onViewSamadhaanDocket,
  onViewEvidenceDocket,
  onToggleAutomationPause,
  sendingLedgerId,
  callingLedgerId,
  togglingLedgerId,
  microTransactionLedgerId,
  downloadingLegalNoticeLedgerId,
  viewingSamadhaanLedgerId,
  downloadingEvidenceDocketLedgerId,
  readOnly = false,
  canSendReminders = true,
  canSpendFunds = false,
  canViewEvidenceDocket = false,
  onReachToast,
}: LedgerActionsProps) {
  return (
    <div className="flex flex-col items-end gap-2 xl:flex-row xl:items-center">
      <LedgerQuickReachActions
        ledger={ledger}
        readOnly={readOnly}
        canSendReminders={canSendReminders}
        onSendReminder={onSendReminder}
        isSending={sendingLedgerId === ledger.id}
        onToast={onReachToast}
      />
      <LedgerActionsMenu
      ledger={ledger}
      readOnly={readOnly}
      canSendReminders={canSendReminders}
      canSpendFunds={canSpendFunds}
      canViewEvidenceDocket={canViewEvidenceDocket}
      onViewPdf={onViewPdf}
      onSendReminder={onSendReminder}
      onSendFromPhone={onSendFromPhone}
      onLogOfflinePayment={onLogOfflinePayment}
      onRectifyLedger={onRectifyLedger}
      onInitiateAiCall={onInitiateAiCall}
      onIssueLegalNotice={onIssueLegalNotice}
      onFileSamadhaan={onFileSamadhaan}
      onDownloadLegalNotice={onDownloadLegalNotice}
      onViewSamadhaanDocket={onViewSamadhaanDocket}
      onViewEvidenceDocket={onViewEvidenceDocket}
      onToggleAutomationPause={onToggleAutomationPause}
      isSending={sendingLedgerId === ledger.id}
      isCalling={callingLedgerId === ledger.id}
      isToggling={togglingLedgerId === ledger.id}
      isMicroProcessing={microTransactionLedgerId === ledger.id}
      isDownloadingLegalNotice={downloadingLegalNoticeLedgerId === ledger.id}
      isViewingSamadhaan={viewingSamadhaanLedgerId === ledger.id}
      isDownloadingEvidenceDocket={
        downloadingEvidenceDocketLedgerId === ledger.id
      }
      />
    </div>
  );
}

function LedgerPaginationControls({
  pagination,
  onPreviousPage,
  onNextPage,
}: {
  pagination: LedgerPagination;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
}) {
  if (pagination.total <= pagination.limit) {
    return null;
  }

  const start = pagination.total === 0 ? 0 : pagination.offset + 1;
  const end = Math.min(pagination.offset + pagination.limit, pagination.total);

  return (
    <div className="flex items-center justify-between border-t border-recoverpe-line px-5 py-4">
      <p className="text-xs text-recoverpe-muted">
        Showing {start}–{end} of {pagination.total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onPreviousPage}
          disabled={pagination.page <= 1}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onNextPage}
          disabled={!pagination.hasMore}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function LedgerTable({
  ledgers,
  onViewPdf,
  onSendReminder,
  onSendFromPhone,
  onLogOfflinePayment,
  onRectifyLedger,
  onInitiateAiCall,
  onIssueLegalNotice,
  onFileSamadhaan,
  onDownloadLegalNotice,
  onViewSamadhaanDocket,
  onViewEvidenceDocket,
  onToggleAutomationPause,
  sendingLedgerId = null,
  callingLedgerId = null,
  togglingLedgerId = null,
  microTransactionLedgerId = null,
  downloadingLegalNoticeLedgerId = null,
  viewingSamadhaanLedgerId = null,
  downloadingEvidenceDocketLedgerId = null,
  readOnly = false,
  canSendReminders = true,
  canSpendFunds = false,
  canViewEvidenceDocket = false,
  onReachToast,
  pagination,
  onPreviousPage,
  onNextPage,
}: LedgerTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => ledgers.some((ledger) => ledger.id === id))
    );
  }, [ledgers]);

  const selectedLedgers = useMemo(
    () => ledgers.filter((ledger) => selectedIds.includes(ledger.id)),
    [ledgers, selectedIds]
  );

  const allVisibleSelected =
    ledgers.length > 0 && ledgers.every((ledger) => selectedIds.includes(ledger.id));

  function toggleLedgerSelection(ledgerId: string) {
    setSelectedIds((current) =>
      current.includes(ledgerId)
        ? current.filter((id) => id !== ledgerId)
        : [...current, ledgerId]
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(ledgers.map((ledger) => ledger.id));
  }

  function handleExportSelected() {
    if (selectedLedgers.length === 0) {
      return;
    }

    downloadLedgersCsv(
      selectedLedgers,
      `ledgers-export-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  const sharedActionProps = {
    onViewPdf,
    onSendReminder,
    onSendFromPhone,
    onLogOfflinePayment,
    onRectifyLedger,
    onInitiateAiCall,
    onIssueLegalNotice,
    onFileSamadhaan,
    onDownloadLegalNotice,
    onViewSamadhaanDocket,
    onViewEvidenceDocket,
    onToggleAutomationPause,
    sendingLedgerId,
    callingLedgerId,
    togglingLedgerId,
    microTransactionLedgerId,
    downloadingLegalNoticeLedgerId,
    viewingSamadhaanLedgerId,
    downloadingEvidenceDocketLedgerId,
    readOnly,
    canSendReminders,
    canSpendFunds,
    canViewEvidenceDocket,
    onReachToast,
  };

  if (ledgers.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            title="No ledger entries yet"
            description="Use New Entry to add your first contact, invoice amount, and due date."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        onExportCsv={handleExportSelected}
      />
      <div className="space-y-3 md:hidden">
        {ledgers.map((ledger) => {
          const displayStatus = getDisplayLedgerStatus(ledger);

          return (
            <Card key={ledger.id} className="group">
              <CardContent className="relative p-6">
                <div className="absolute left-5 top-5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${ledger.contact.name}`}
                    checked={selectedIds.includes(ledger.id)}
                    onChange={() => toggleLedgerSelection(ledger.id)}
                    className="focus-ring h-4 w-4 rounded border-recoverpe-line"
                  />
                </div>
                <div className="absolute right-5 top-5">
                  <LedgerRowActions
                    {...sharedActionProps}
                    ledger={ledger}
                  />
                </div>
                <div className="pr-10 pl-9">
                  <p className="truncate text-sm font-semibold text-recoverpe-black">
                    {ledger.contact.name}
                  </p>
                  <p className="type-data-secondary mt-1 truncate">
                    {ledger.contact.phone_number}
                    {ledger.communication_paused ? " · Automations paused" : ""}
                  </p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="type-table-header">Balance Due</p>
                    <p className={`${AMOUNT_CLASS} mt-2 text-base`}>
                      {formatCurrency(ledger.balance_due)}
                    </p>
                  </div>
                  <div>
                    <p className="type-table-header">Due Date</p>
                    <p className="type-data-secondary mt-2 text-sm">
                      {formatDueDate(ledger.due_date)}
                    </p>
                  </div>
                  <div>
                    <p className="type-table-header">Amount</p>
                    <p className={`${AMOUNT_CLASS} mt-2 text-base`}>
                      {formatCurrency(ledger.total_amount)}
                    </p>
                  </div>
                  <div className="flex items-end">
                    <StatusBadge status={displayStatus} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all visible ledgers"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="focus-ring h-4 w-4 rounded border-recoverpe-line"
                  />
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance Due</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgers.map((ledger) => {
                const displayStatus = getDisplayLedgerStatus(ledger);

                return (
                  <TableRow key={ledger.id} className="group">
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Select ${ledger.contact.name}`}
                        checked={selectedIds.includes(ledger.id)}
                        onChange={() => toggleLedgerSelection(ledger.id)}
                        className="focus-ring h-4 w-4 rounded border-recoverpe-line"
                      />
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm font-semibold text-recoverpe-black">
                        {ledger.contact.name}
                      </p>
                      <p className="type-data-secondary mt-1 truncate">
                        {ledger.contact.phone_number}
                        {ledger.communication_paused ? " · Automations paused" : ""}
                      </p>
                    </TableCell>
                    <TableCell className={AMOUNT_CLASS}>
                      {formatCurrency(ledger.total_amount)}
                    </TableCell>
                    <TableCell className={AMOUNT_CLASS}>
                      {formatCurrency(ledger.balance_due)}
                    </TableCell>
                    <TableCell className="type-data-secondary">
                      {formatDueDate(ledger.due_date)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={displayStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="opacity-100 transition-opacity duration-150 ease-out md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                        <LedgerRowActions
                          {...sharedActionProps}
                          ledger={ledger}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {pagination ? (
            <LedgerPaginationControls
              pagination={pagination}
              onPreviousPage={onPreviousPage}
              onNextPage={onNextPage}
            />
          ) : null}
        </CardContent>
      </Card>

      {pagination ? (
        <div className="md:hidden">
          <Card>
            <LedgerPaginationControls
              pagination={pagination}
              onPreviousPage={onPreviousPage}
              onNextPage={onNextPage}
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
