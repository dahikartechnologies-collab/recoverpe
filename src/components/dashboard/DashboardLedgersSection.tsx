"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EscalateModal } from "@/components/dashboard/EscalateModal";
import { ExportLedgerButton } from "@/components/dashboard/ExportLedgerButton";
import { ConfettiBurst } from "@/components/dashboard/ConfettiBurst";
import { InvoiceViewModal } from "@/components/dashboard/InvoiceViewModal";
import { LedgerTable } from "@/components/dashboard/LedgerTable";
import { LedgerTableSkeleton } from "@/components/dashboard/LedgerTableSkeleton";
import { LegalNoticeSuccessModal } from "@/components/dashboard/LegalNoticeSuccessModal";
import { LogOfflinePaymentModal } from "@/components/dashboard/LogOfflinePaymentModal";
import { MicroTransactionConfirmModal } from "@/components/dashboard/MicroTransactionConfirmModal";
import { RectifyLedgerModal } from "@/components/dashboard/RectifyLedgerModal";
import { SamadhaanGuideModal } from "@/components/dashboard/SamadhaanGuideModal";
import { PredictiveTriageList } from "@/components/dashboard/PredictiveTriageList";
import { TriageZone } from "@/components/dashboard/TriageZone";
import { WallOfShameWidget } from "@/components/dashboard/WallOfShameWidget";
import { RecoveryUpsellModal } from "@/components/billing/RecoveryUpsellModal";
import { Toast } from "@/components/ui/Toast";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useDashboardIntelligence } from "@/hooks/use-dashboard-intelligence";
import { useBusinessProfileUpsell } from "@/hooks/use-business-profile-upsell";
import { WallOfShameEntry } from "@/lib/dashboard-intelligence-client";
import { getAuthHeaders } from "@/lib/businesses";
import { formatCurrency } from "@/lib/gst";
import { downloadDocumentFromApiRoute } from "@/lib/pdf-download";
import { initiateVapiCall } from "@/lib/vapi-client";
import { updateLedgerCommunicationPaused } from "@/lib/ledger-settings";
import { sendWhatsAppReminder } from "@/lib/messages";
import {
  recordRecoveryUpsell,
  startRazorpayCheckout,
} from "@/lib/razorpay-client";
import {
  PURCHASE_PRODUCTS,
  RECOVERY_UPSELL_THRESHOLD_INR,
} from "@/lib/razorpay-products";
import { fetchCurrentUser } from "@/lib/users";
import { buildWhatsAppMeLink } from "@/lib/wa-me";
import { buildWhatsAppReminderBody } from "@/lib/whatsapp-content";
import {
  canExportData,
  canMutateLedgers,
  canSendReminders,
  canSpendFunds,
  canViewEvidenceDocket,
} from "@/lib/workspace-permissions";
import { isPremiumBusiness } from "@/lib/workspace-rbac";
import { openEvidenceDocketPdf, loadSamadhaanFulfillment } from "@/lib/ledger-docket-client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { LedgerWithContact, MicroTransactionFulfillment, PurchaseType, WorkspaceMode } from "@/types";

type MicroPurchaseType = Extract<
  PurchaseType,
  "legal_notice_999" | "samadhaan_499"
>;

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
  const bumpUserRefresh = useWorkspaceStore((state) => state.bumpUserRefresh);
  const subscriptionPlan = useWorkspaceStore((state) => state.subscriptionPlan);
  const openUpgradeModal = useWorkspaceStore((state) => state.openUpgradeModal);
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const readOnly = !canMutateLedgers(workspaceRole, customPermissions);
  const remindersEnabled = canSendReminders(workspaceRole, customPermissions);
  const spendFundsEnabled = canSpendFunds(workspaceRole, customPermissions);
  const exportEnabled = canExportData(workspaceRole, customPermissions);
  const evidenceDocketEnabled = canViewEvidenceDocket(
    workspaceRole,
    customPermissions
  );
  const { requireCompleteProfile, profileUpsellModal, gateLegalDocuments } =
    useBusinessProfileUpsell();
  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === businessId) ?? null,
    [businesses, businessId]
  );
  const hasPremiumPredictions = useMemo(() => {
    if (workspaceMode === "business") {
      return isPremiumBusiness(activeBusiness);
    }

    return subscriptionPlan === "premium";
  }, [workspaceMode, activeBusiness, subscriptionPlan]);
  const { ledgers, metrics, pagination, error, isLoading, reload, goToPreviousPage, goToNextPage } = useDashboardData(
    workspaceMode,
    businessId
  );
  const {
    intelligence,
    error: intelligenceError,
    isLoading: isIntelligenceLoading,
    reload: reloadIntelligence,
  } = useDashboardIntelligence(workspaceMode, businessId);
  const [selectedLedger, setSelectedLedger] = useState<LedgerWithContact | null>(
    null
  );
  const [paymentLedger, setPaymentLedger] = useState<LedgerWithContact | null>(
    null
  );
  const [rectifyLedger, setRectifyLedger] = useState<LedgerWithContact | null>(
    null
  );
  const [escalateEntry, setEscalateEntry] = useState<WallOfShameEntry | null>(null);
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRectifyModalOpen, setIsRectifyModalOpen] = useState(false);
  const [legalNoticeFulfillment, setLegalNoticeFulfillment] =
    useState<MicroTransactionFulfillment | null>(null);
  const [samadhaanFulfillment, setSamadhaanFulfillment] =
    useState<MicroTransactionFulfillment | null>(null);
  const [isLegalNoticeModalOpen, setIsLegalNoticeModalOpen] = useState(false);
  const [isSamadhaanModalOpen, setIsSamadhaanModalOpen] = useState(false);
  const [sendingLedgerId, setSendingLedgerId] = useState<string | null>(null);
  const [callingLedgerId, setCallingLedgerId] = useState<string | null>(null);
  const [escalatingWhatsApp, setEscalatingWhatsApp] = useState(false);
  const [escalatingCall, setEscalatingCall] = useState(false);
  const [togglingLedgerId, setTogglingLedgerId] = useState<string | null>(null);
  const [microTransactionLedgerId, setMicroTransactionLedgerId] = useState<
    string | null
  >(null);
  const [downloadingLegalNoticeLedgerId, setDownloadingLegalNoticeLedgerId] =
    useState<string | null>(null);
  const [viewingSamadhaanLedgerId, setViewingSamadhaanLedgerId] = useState<
    string | null
  >(null);
  const [downloadingEvidenceDocketLedgerId, setDownloadingEvidenceDocketLedgerId] =
    useState<string | null>(null);
  const [pendingMicroTransaction, setPendingMicroTransaction] = useState<{
    ledger: LedgerWithContact;
    purchaseType: MicroPurchaseType;
  } | null>(null);
  const [isMicroConfirmOpen, setIsMicroConfirmOpen] = useState(false);
  const [isMicroPaymentProcessing, setIsMicroPaymentProcessing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isRecoveryUpsellOpen, setIsRecoveryUpsellOpen] = useState(false);
  const [recoveryUpsellEligible, setRecoveryUpsellEligible] = useState(false);
  const recoveryUpsellCheckedRef = useRef(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (
      recoveryUpsellCheckedRef.current ||
      isLoading ||
      subscriptionPlan !== "free" ||
      metrics.recoveredViaRecoverpe < RECOVERY_UPSELL_THRESHOLD_INR
    ) {
      return;
    }

    recoveryUpsellCheckedRef.current = true;

    async function triggerRecoveryUpsell() {
      try {
        const user = await fetchCurrentUser();

        if (user.recovery_upsell_shown || user.subscription_plan === "premium") {
          return;
        }

        const result = await recordRecoveryUpsell();
        setRecoveryUpsellEligible(result.eligible_for_discount);
        setShowConfetti(true);
        setIsRecoveryUpsellOpen(true);
        bumpUserRefresh();
      } catch {
        recoveryUpsellCheckedRef.current = false;
      }
    }

    void triggerRecoveryUpsell();
  }, [
    bumpUserRefresh,
    isLoading,
    metrics.recoveredViaRecoverpe,
    subscriptionPlan,
  ]);

  function openMicroTransactionConfirm(
    ledger: LedgerWithContact,
    purchaseType: MicroPurchaseType
  ) {
    setPendingMicroTransaction({ ledger, purchaseType });
    setIsMicroConfirmOpen(true);
  }

  function closeMicroTransactionConfirm() {
    if (isMicroPaymentProcessing) {
      return;
    }

    setIsMicroConfirmOpen(false);
    setPendingMicroTransaction(null);
  }

  async function handleConfirmMicroTransaction() {
    if (!pendingMicroTransaction) {
      return;
    }

    const { ledger, purchaseType } = pendingMicroTransaction;
    const product = PURCHASE_PRODUCTS[purchaseType];

    setIsMicroPaymentProcessing(true);
    setMicroTransactionLedgerId(ledger.id);

    try {
      await startRazorpayCheckout({
        purchaseType,
        ledgerId: ledger.id,
        description: `${product.label} — ${ledger.contact.name}`,
        onSuccess: (microFulfillment) => {
          setIsMicroConfirmOpen(false);
          setPendingMicroTransaction(null);

          if (!microFulfillment) {
            setToast({
              message: `${product.label} payment received. Fulfillment is processing.`,
              variant: "success",
            });
            return;
          }

          if (purchaseType === "legal_notice_999") {
            setLegalNoticeFulfillment(microFulfillment);
            setIsLegalNoticeModalOpen(true);
            return;
          }

          setSamadhaanFulfillment(microFulfillment);
          setIsSamadhaanModalOpen(true);
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Payment cancelled.") {
        return;
      }

      setToast({
        message:
          error instanceof Error ? error.message : "Payment could not be completed.",
        variant: "error",
      });
    } finally {
      setIsMicroPaymentProcessing(false);
      setMicroTransactionLedgerId(null);
    }
  }

  async function handleMicroTransaction(
    ledger: LedgerWithContact,
    purchaseType: MicroPurchaseType
  ) {
    if (!spendFundsEnabled) {
      setToast({
        message: "You do not have permission to initiate paid transactions.",
        variant: "error",
      });
      return;
    }

    if (purchaseType === "samadhaan_499" && !requireCompleteProfile()) {
      return;
    }

    openMicroTransactionConfirm(ledger, purchaseType);
  }

  async function handleDownloadLegalNotice(ledger: LedgerWithContact) {
    setDownloadingLegalNoticeLedgerId(ledger.id);

    try {
      const headers = await getAuthHeaders();
      await downloadDocumentFromApiRoute(
        "legal-notice",
        ledger.id,
        `legal-notice-${ledger.id}.pdf`,
        headers
      );
    } catch (downloadError) {
      setToast({
        message:
          downloadError instanceof Error
            ? downloadError.message
            : "Failed to download legal notice PDF.",
        variant: "error",
      });
    } finally {
      setDownloadingLegalNoticeLedgerId(null);
    }
  }

  async function handleViewSamadhaanDocket(ledger: LedgerWithContact) {
    if (!requireCompleteProfile()) {
      return;
    }

    setViewingSamadhaanLedgerId(ledger.id);

    try {
      const fulfillment = await loadSamadhaanFulfillment(ledger.id);
      setSamadhaanFulfillment(fulfillment);
      setIsSamadhaanModalOpen(true);
    } catch (viewError) {
      setToast({
        message:
          viewError instanceof Error
            ? viewError.message
            : "Failed to open Samadhaan kit.",
        variant: "error",
      });
    } finally {
      setViewingSamadhaanLedgerId(null);
    }
  }

  async function handleViewEvidenceDocket(ledger: LedgerWithContact) {
    setDownloadingEvidenceDocketLedgerId(ledger.id);

    try {
      await openEvidenceDocketPdf(ledger.id);
    } catch (viewError) {
      setToast({
        message:
          viewError instanceof Error
            ? viewError.message
            : "Failed to open evidence docket.",
        variant: "error",
      });
    } finally {
      setDownloadingEvidenceDocketLedgerId(null);
    }
  }

  async function refreshDashboard() {
    bumpLedgerRefresh();
    await Promise.all([reload(), reloadIntelligence()]);
  }

  function handleViewPdf(ledger: LedgerWithContact) {
    if (ledger.pdf_url && !ledger.is_custom_pdf && !requireCompleteProfile()) {
      return;
    }

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

  function handleRectifyLedger(ledger: LedgerWithContact) {
    setRectifyLedger(ledger);
    setIsRectifyModalOpen(true);
  }

  function handleCloseRectifyModal() {
    setIsRectifyModalOpen(false);
    setRectifyLedger(null);
  }

  async function handleRectifySuccess() {
    setToast({
      message: "Ledger rectified. Previous version saved to revision history.",
      variant: "success",
    });
    await refreshDashboard();
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

  function handleEscalate(entry: WallOfShameEntry) {
    setEscalateEntry(entry);
    setIsEscalateModalOpen(true);
  }

  function handleCloseEscalateModal() {
    setIsEscalateModalOpen(false);
    setEscalateEntry(null);
  }

  async function handleEscalateWhatsApp(ledgerId: string) {
    setEscalatingWhatsApp(true);

    try {
      const result = await sendWhatsAppReminder({ ledger_id: ledgerId });

      setToast({
        message: result.simulated
          ? "WhatsApp warning simulated successfully (development mode)."
          : "WhatsApp warning sent successfully.",
        variant: "success",
      });

      await refreshDashboard();
    } finally {
      setEscalatingWhatsApp(false);
    }
  }

  async function handleEscalateAiCall(ledgerId: string) {
    setEscalatingCall(true);

    try {
      const result = await initiateVapiCall({ ledger_id: ledgerId });

      setToast({
        message: result.simulated
          ? "AI call simulated successfully (development mode)."
          : "AI voice call initiated successfully.",
        variant: "success",
      });

      bumpWalletRefresh();
      await refreshDashboard();
    } finally {
      setEscalatingCall(false);
    }
  }

  function handleSendFromPhone(ledger: LedgerWithContact) {
    const businessName =
      ledger.business_id != null
        ? businesses.find((business) => business.id === ledger.business_id)
            ?.business_name ?? null
        : null;
    const message = buildWhatsAppReminderBody({
      ledger,
      businessName,
      subscriptionPlan,
      payPageUrl: `${window.location.origin}/pay/${ledger.id}`,
    });
    const waMeUrl = buildWhatsAppMeLink(ledger.contact.phone_number, message);

    window.open(waMeUrl, "_blank", "noopener,noreferrer");
  }

  async function handleSendReminder(ledger: LedgerWithContact) {
    setSendingLedgerId(ledger.id);

    try {
      const result = await sendWhatsAppReminder({ ledger_id: ledger.id });

      setToast({
        message: result.fallbackTriggered
          ? `Reminder sent via ${result.channel === "email" ? "email" : "WhatsApp"} (fallback).`
          : result.channel === "email"
            ? result.simulated
              ? "Email reminder simulated successfully (development mode)."
              : "Email reminder sent successfully."
            : result.simulated
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
    <div className="space-y-8">
      <ConfettiBurst active={showConfetti} />
      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
      {intelligenceError ? (
        <p className="text-sm text-recoverpe-error">{intelligenceError}</p>
      ) : null}

      <PredictiveTriageList
        ledgers={ledgers}
        isLoading={isLoading}
        isPremium={hasPremiumPredictions}
        onUpgrade={openUpgradeModal}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <WallOfShameWidget
          entries={intelligence.wall_of_shame}
          isLoading={isIntelligenceLoading}
          onEscalate={handleEscalate}
        />
        <TriageZone
          hostileCalls={intelligence.hostile_calls}
          pendingVerifications={intelligence.pending_verifications}
          isLoading={isIntelligenceLoading}
        />
      </div>

      {isLoading ? (
        <LedgerTableSkeleton />
      ) : (
        <>
          <div className="flex justify-end">
            {exportEnabled ? (
              <ExportLedgerButton
                ledgers={ledgers}
                filename="recoverpe-dashboard-ledgers.csv"
              />
            ) : null}
          </div>
          <LedgerTable
            ledgers={ledgers}
            readOnly={readOnly}
            canSendReminders={remindersEnabled}
            canSpendFunds={spendFundsEnabled}
            canViewEvidenceDocket={evidenceDocketEnabled}
            pagination={pagination}
          onPreviousPage={goToPreviousPage}
          onNextPage={goToNextPage}
          onViewPdf={handleViewPdf}
          onSendReminder={handleSendReminder}
          onSendFromPhone={handleSendFromPhone}
          onLogOfflinePayment={handleLogOfflinePayment}
          onRectifyLedger={handleRectifyLedger}
          onInitiateAiCall={handleInitiateAiCall}
          onIssueLegalNotice={(ledger) =>
            void handleMicroTransaction(ledger, "legal_notice_999")
          }
          onFileSamadhaan={(ledger) =>
            void handleMicroTransaction(ledger, "samadhaan_499")
          }
          onDownloadLegalNotice={(ledger) =>
            void handleDownloadLegalNotice(ledger)
          }
          onViewSamadhaanDocket={(ledger) =>
            void handleViewSamadhaanDocket(ledger)
          }
          onViewEvidenceDocket={(ledger) =>
            void handleViewEvidenceDocket(ledger)
          }
          onToggleAutomationPause={handleToggleAutomationPause}
          sendingLedgerId={sendingLedgerId}
          callingLedgerId={callingLedgerId}
          togglingLedgerId={togglingLedgerId}
          microTransactionLedgerId={microTransactionLedgerId}
          downloadingLegalNoticeLedgerId={downloadingLegalNoticeLedgerId}
          viewingSamadhaanLedgerId={viewingSamadhaanLedgerId}
          downloadingEvidenceDocketLedgerId={downloadingEvidenceDocketLedgerId}
        />
        </>
      )}

      <EscalateModal
        entry={escalateEntry}
        isOpen={isEscalateModalOpen}
        onClose={handleCloseEscalateModal}
        onSendWhatsApp={handleEscalateWhatsApp}
        onInitiateAiCall={handleEscalateAiCall}
        isSendingWhatsApp={escalatingWhatsApp}
        isCalling={escalatingCall}
      />

      <InvoiceViewModal
        ledger={selectedLedger}
        isOpen={isInvoiceModalOpen}
        onClose={handleCloseInvoiceModal}
        canViewEvidenceDocket={evidenceDocketEnabled}
        canSpendFunds={spendFundsEnabled}
        readOnly={readOnly}
        gateLegalDocuments={gateLegalDocuments}
        onProfileIncomplete={() => {
          requireCompleteProfile();
        }}
        onGenerateSamadhaanKit={(ledger) =>
          void handleMicroTransaction(ledger, "samadhaan_499")
        }
        onViewSamadhaanKit={(ledger) => void handleViewSamadhaanDocket(ledger)}
        isGeneratingSamadhaan={
          selectedLedger ? microTransactionLedgerId === selectedLedger.id : false
        }
        isViewingSamadhaan={
          selectedLedger ? viewingSamadhaanLedgerId === selectedLedger.id : false
        }
      />

      {profileUpsellModal}

      <LogOfflinePaymentModal
        ledger={paymentLedger}
        isOpen={isPaymentModalOpen}
        onClose={handleClosePaymentModal}
        onSuccess={handlePaymentSuccess}
      />

      <RectifyLedgerModal
        ledger={rectifyLedger}
        isOpen={isRectifyModalOpen}
        onClose={handleCloseRectifyModal}
        onSuccess={handleRectifySuccess}
      />

      <MicroTransactionConfirmModal
        ledger={pendingMicroTransaction?.ledger ?? null}
        purchaseType={pendingMicroTransaction?.purchaseType ?? null}
        isOpen={isMicroConfirmOpen}
        isProcessing={isMicroPaymentProcessing}
        onClose={closeMicroTransactionConfirm}
        onConfirm={() => void handleConfirmMicroTransaction()}
      />

      <LegalNoticeSuccessModal
        fulfillment={legalNoticeFulfillment}
        isOpen={isLegalNoticeModalOpen}
        onClose={() => {
          setIsLegalNoticeModalOpen(false);
          setLegalNoticeFulfillment(null);
          void refreshDashboard();
        }}
      />

      <SamadhaanGuideModal
        fulfillment={samadhaanFulfillment}
        isOpen={isSamadhaanModalOpen}
        onClose={() => {
          setIsSamadhaanModalOpen(false);
          setSamadhaanFulfillment(null);
          void refreshDashboard();
        }}
      />

      <RecoveryUpsellModal
        isOpen={isRecoveryUpsellOpen}
        onClose={() => {
          setIsRecoveryUpsellOpen(false);
          setShowConfetti(false);
        }}
        recoveredAmountLabel={formatCurrency(metrics.recoveredViaRecoverpe)}
        eligibleForDiscount={recoveryUpsellEligible}
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
