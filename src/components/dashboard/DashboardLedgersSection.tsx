"use client";

import { useCallback, useState } from "react";
import { HeroMetricCard } from "@/components/dashboard/HeroMetricCard";
import { InvoiceViewModal } from "@/components/dashboard/InvoiceViewModal";
import { LedgerTable } from "@/components/dashboard/LedgerTable";
import { LogOfflinePaymentModal } from "@/components/dashboard/LogOfflinePaymentModal";
import { Toast } from "@/components/ui/Toast";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { initiateVapiCall } from "@/lib/vapi-client";
import { updateLedgerCommunicationPaused } from "@/lib/ledger-settings";
import { sendWhatsAppReminder } from "@/lib/messages";
import { useWorkspaceStore } from "@/store/workspace-store";
import { LedgerWithContact, WorkspaceMode } from "@/types";

interface DashboardLedgersSectionProps {
  workspaceMode: WorkspaceMode;
  businessId?: string | null;
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

export function DashboardLedgersSection({
  workspaceMode,
  businessId = null,
}: DashboardLedgersSectionProps) {
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);
  const bumpWalletRefresh = useWorkspaceStore((state) => state.bumpWalletRefresh);
  const { ledgers, metrics, error, isLoading, reload } = useDashboardData(
    workspaceMode,
    businessId
  );
  const [selectedLedger, setSelectedLedger] = useState<LedgerWithContact | null>(
    null
  );
  const [paymentLedger, setPaymentLedger] = useState<LedgerWithContact | null>(
    null
  );
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [sendingLedgerId, setSendingLedgerId] = useState<string | null>(null);
  const [callingLedgerId, setCallingLedgerId] = useState<string | null>(null);
  const [togglingLedgerId, setTogglingLedgerId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  async function refreshDashboard() {
    bumpLedgerRefresh();
    await reload();
  }

  function handleViewPdf(ledger: LedgerWithContact) {
    setSelectedLedger(ledger);
    setIsInvoiceModalOpen(true);
  }

  function handleCloseInvoiceModal() {
    setIsInvoiceModalOpen(false);
    setSelectedLedger(null);
  }

  function handleLogOfflinePayment(ledger: LedgerWithContact) {
    setPaymentLedger(ledger);
    setIsPaymentModalOpen(true);
  }

  function handleClosePaymentModal() {
    setIsPaymentModalOpen(false);
    setPaymentLedger(null);
  }

  async function handlePaymentSuccess() {
    setToast({
      message: "Offline payment logged. Balance due updated.",
      variant: "success",
    });
    await refreshDashboard();
  }

  async function handleSendReminder(ledger: LedgerWithContact) {
    setSendingLedgerId(ledger.id);

    try {
      const result = await sendWhatsAppReminder({ ledger_id: ledger.id });

      setToast({
        message: result.simulated
          ? "WhatsApp reminder simulated successfully (development mode)."
          : "WhatsApp reminder sent successfully.",
        variant: "success",
      });

      await refreshDashboard();
    } catch (sendError) {
      setToast({
        message:
          sendError instanceof Error
            ? sendError.message
            : "Failed to send WhatsApp reminder.",
        variant: "error",
      });
    } finally {
      setSendingLedgerId(null);
    }
  }

  async function handleInitiateAiCall(ledger: LedgerWithContact) {
    setCallingLedgerId(ledger.id);

    try {
      const result = await initiateVapiCall({ ledger_id: ledger.id });

      setToast({
        message: result.simulated
          ? "AI call with Sneha simulated successfully (development mode)."
          : "AI voice call initiated successfully.",
        variant: "success",
      });

      bumpWalletRefresh();
      await refreshDashboard();
    } catch (callError) {
      setToast({
        message:
          callError instanceof Error
            ? callError.message
            : "Failed to initiate AI voice call.",
        variant: "error",
      });
    } finally {
      setCallingLedgerId(null);
    }
  }

  async function handleToggleAutomationPause(
    ledger: LedgerWithContact,
    communicationPaused: boolean
  ) {
    setTogglingLedgerId(ledger.id);

    try {
      await updateLedgerCommunicationPaused(ledger.id, communicationPaused);

      setToast({
        message: communicationPaused
          ? "Automations paused for this ledger."
          : "Automations resumed for this ledger.",
        variant: "success",
      });

      await refreshDashboard();
    } catch (toggleError) {
      setToast({
        message:
          toggleError instanceof Error
            ? toggleError.message
            : "Failed to update automation settings.",
        variant: "error",
      });
    } finally {
      setTogglingLedgerId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <HeroMetricCard
          label="Total Outstanding"
          description={
            workspaceMode === "personal"
              ? "Personal balances awaiting collection."
              : "Open receivables for this business profile."
          }
          value={metrics.totalOutstanding}
        />
        <HeroMetricCard
          label="Severely Overdue"
          description={
            workspaceMode === "personal"
              ? "Personal entries past their due date."
              : "Business invoices past escalation thresholds."
          }
          value={metrics.severelyOverdue}
        />
        <HeroMetricCard
          label="Recovered via Recoverpe"
          description={
            workspaceMode === "personal"
              ? "Amount collected through personal reminders."
              : "Collections attributed to automated follow-ups."
          }
          value={metrics.recoveredViaRecoverpe}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-recoverpe-grey-medium">Loading ledger entries...</p>
      ) : (
        <LedgerTable
          ledgers={ledgers}
          onViewPdf={handleViewPdf}
          onSendReminder={handleSendReminder}
          onLogOfflinePayment={handleLogOfflinePayment}
          onInitiateAiCall={handleInitiateAiCall}
          onToggleAutomationPause={handleToggleAutomationPause}
          sendingLedgerId={sendingLedgerId}
          callingLedgerId={callingLedgerId}
          togglingLedgerId={togglingLedgerId}
        />
      )}

      <InvoiceViewModal
        ledger={selectedLedger}
        isOpen={isInvoiceModalOpen}
        onClose={handleCloseInvoiceModal}
      />

      <LogOfflinePaymentModal
        ledger={paymentLedger}
        isOpen={isPaymentModalOpen}
        onClose={handleClosePaymentModal}
        onSuccess={handlePaymentSuccess}
      />

      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={dismissToast}
        />
      ) : null}
    </div>
  );
}
