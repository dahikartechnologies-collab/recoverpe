"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AssignAgentCard } from "@/components/dashboard/AssignAgentCard";
import { CommunicationHistory } from "@/components/dashboard/CommunicationHistory";
import { ExportLedgerButton } from "@/components/dashboard/ExportLedgerButton";
import { HeroMetricCard } from "@/components/dashboard/HeroMetricCard";
import { LedgerTable } from "@/components/dashboard/LedgerTable";
import { LogAdvanceModal } from "@/components/dashboard/LogAdvanceModal";
import { LogOfflinePaymentModal } from "@/components/dashboard/LogOfflinePaymentModal";
import { MicroTransactionConfirmModal } from "@/components/dashboard/MicroTransactionConfirmModal";
import { SamadhaanGuideModal } from "@/components/dashboard/SamadhaanGuideModal";
import { ContactVirtualAccountCard } from "@/components/dashboard/ContactVirtualAccountCard";
import { SmartCollectCard } from "@/components/dashboard/SmartCollectCard";
import { WalletBalanceCard } from "@/components/dashboard/WalletBalanceCard";
import { Toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { useBusinessProfileUpsell } from "@/hooks/use-business-profile-upsell";
import {
  fetchVendorDetail,
  generateVendorPortalLink,
  provisionVendorVirtualAccount,
} from "@/lib/vendor-client";
import { sendWhatsAppReminder } from "@/lib/messages";
import { initiateVapiCall } from "@/lib/vapi-client";
import { updateLedgerCommunicationPaused } from "@/lib/ledger-settings";
import {
  loadSamadhaanFulfillment,
  openEvidenceDocketPdf,
} from "@/lib/ledger-docket-client";
import { startRazorpayCheckout } from "@/lib/razorpay-client";
import { PURCHASE_PRODUCTS } from "@/lib/razorpay-products";
import {
  canExportData,
  canMutateLedgers,
  canSendReminders,
  canSpendFunds,
  canViewEvidenceDocket,
} from "@/lib/workspace-permissions";
import { formatCurrency } from "@/lib/gst";
import {
  ContactDirectoryEntry,
  ContactVirtualAccountDetails,
  LedgerPagination,
  LedgerWithContact,
  MicroTransactionFulfillment,
  VirtualAccount,
  WalletTransactionEntry,
} from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

const PAGE_SIZE = 50;

interface VendorDetailClientProps {
  contactId: string;
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

type VendorDetailTab = "ledger" | "communications";

const VENDOR_DETAIL_TABS: Array<{ id: VendorDetailTab; label: string }> = [
  { id: "ledger", label: "Statement & Wallet" },
  { id: "communications", label: "Communication History" },
];

export function VendorDetailClient({ contactId }: VendorDetailClientProps) {
  const searchParams = useSearchParams();
  const mode = useWorkspaceStore((state) => state.mode);
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const readOnly = !canMutateLedgers(workspaceRole, customPermissions);
  const remindersEnabled = canSendReminders(workspaceRole, customPermissions);
  const spendFundsEnabled = canSpendFunds(workspaceRole, customPermissions);
  const exportEnabled = canExportData(workspaceRole, customPermissions);
  const evidenceDocketEnabled = canViewEvidenceDocket(
    workspaceRole,
    customPermissions
  );
  const { requireCompleteProfile, profileUpsellModal } = useBusinessProfileUpsell();
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);
  const bumpWalletRefresh = useWorkspaceStore((state) => state.bumpWalletRefresh);
  const ledgerRefreshKey = useWorkspaceStore((state) => state.ledgerRefreshKey);
  const walletRefreshKey = useWorkspaceStore((state) => state.walletRefreshKey);
  const openLedgerModal = useWorkspaceStore((state) => state.openLedgerModal);
  const setViewLedgerId = useWorkspaceStore((state) => state.setViewLedgerId);
  const [contact, setContact] = useState<ContactDirectoryEntry | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionEntry[]>([]);
  const [ledgers, setLedgers] = useState<LedgerWithContact[]>([]);
  const [pagination, setPagination] = useState<LedgerPagination | null>(null);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [contactVirtualAccount, setContactVirtualAccount] =
    useState<ContactVirtualAccountDetails | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isProvisioningVirtualAccount, setIsProvisioningVirtualAccount] =
    useState(false);
  const [isGeneratingPortalLink, setIsGeneratingPortalLink] = useState(false);
  const [error, setError] = useState("");
  const [paymentLedger, setPaymentLedger] = useState<LedgerWithContact | null>(
    null
  );
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [sendingLedgerId, setSendingLedgerId] = useState<string | null>(null);
  const [callingLedgerId, setCallingLedgerId] = useState<string | null>(null);
  const [togglingLedgerId, setTogglingLedgerId] = useState<string | null>(null);
  const [microTransactionLedgerId, setMicroTransactionLedgerId] = useState<
    string | null
  >(null);
  const [viewingSamadhaanLedgerId, setViewingSamadhaanLedgerId] = useState<
    string | null
  >(null);
  const [downloadingEvidenceDocketLedgerId, setDownloadingEvidenceDocketLedgerId] =
    useState<string | null>(null);
  const [pendingSamadhaanLedger, setPendingSamadhaanLedger] =
    useState<LedgerWithContact | null>(null);
  const [isSamadhaanConfirmOpen, setIsSamadhaanConfirmOpen] = useState(false);
  const [isSamadhaanProcessing, setIsSamadhaanProcessing] = useState(false);
  const [samadhaanFulfillment, setSamadhaanFulfillment] =
    useState<MicroTransactionFulfillment | null>(null);
  const [isSamadhaanModalOpen, setIsSamadhaanModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [activeTab, setActiveTab] = useState<VendorDetailTab>("ledger");

  const loadVendor = useCallback(
    async (targetPage: number) => {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetchVendorDetail(contactId, {
          page: targetPage,
          limit: PAGE_SIZE,
          businessId: mode === "personal" ? null : activeBusinessId,
          workspaceMode: mode,
        });
        setContact(response.contact);
        setWalletBalance(response.wallet_balance);
        setWalletTransactions(response.wallet_transactions ?? []);
        setLedgers(response.ledgers);
        setPagination(response.pagination);
        setVirtualAccount(response.virtual_account);
        setContactVirtualAccount(response.contact_virtual_account);
        setBusinessName(response.business_name);
        setPage(response.pagination.page);
      } catch (loadError) {
        setContact(null);
        setLedgers([]);
        setWalletTransactions([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load vendor statement."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [contactId, mode, activeBusinessId]
  );

  useEffect(() => {
    setPage(1);
  }, [contactId]);

  useEffect(() => {
    void loadVendor(page);
  }, [loadVendor, page, ledgerRefreshKey, walletRefreshKey]);

  useEffect(() => {
    const ledgerId = searchParams.get("ledger");

    if (!ledgerId || ledgers.length === 0) {
      return;
    }

    const matchedLedger = ledgers.find((ledger) => ledger.id === ledgerId);

    if (matchedLedger) {
      setViewLedgerId(matchedLedger.id);
    }
  }, [searchParams, ledgers, setViewLedgerId]);

  function showToast(message: string, variant: ToastState["variant"]) {
    setToast({ message, variant });
  }

  async function handleProvisionVirtualAccount() {
    setIsProvisioningVirtualAccount(true);

    try {
      const response = await provisionVendorVirtualAccount(
        contactId,
        activeBusinessId
      );
      setVirtualAccount(response.virtual_account);
      showToast(
        response.simulated
          ? "Virtual payment details generated (development simulation)."
          : "Virtual payment details generated.",
        "success"
      );
    } catch (provisionError) {
      showToast(
        provisionError instanceof Error
          ? provisionError.message
          : "Failed to generate virtual payment details.",
        "error"
      );
    } finally {
      setIsProvisioningVirtualAccount(false);
    }
  }

  async function handleGeneratePortalLink() {
    setIsGeneratingPortalLink(true);

    try {
      const response = await generateVendorPortalLink(contactId, activeBusinessId);
      await navigator.clipboard.writeText(response.url);
      showToast("Portal link copied to clipboard.", "success");
    } catch (portalError) {
      showToast(
        portalError instanceof Error
          ? portalError.message
          : "Failed to generate portal link.",
        "error"
      );
    } finally {
      setIsGeneratingPortalLink(false);
    }
  }

  async function handleSendReminder(ledger: LedgerWithContact) {
    setSendingLedgerId(ledger.id);

    try {
      const result = await sendWhatsAppReminder({ ledger_id: ledger.id });
      showToast(
        result.fallbackTriggered
          ? `Reminder sent via ${result.channel === "email" ? "email" : "WhatsApp"} (fallback).`
          : result.channel === "email"
            ? "Email reminder sent."
            : result.simulated
              ? "WhatsApp reminder simulated (development mode)."
              : "WhatsApp reminder sent.",
        "success"
      );
      bumpLedgerRefresh();
    } catch (sendError) {
      showToast(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send reminder.",
        "error"
      );
    } finally {
      setSendingLedgerId(null);
    }
  }

  async function handleInitiateAiCall(ledger: LedgerWithContact) {
    setCallingLedgerId(ledger.id);

    try {
      await initiateVapiCall({ ledger_id: ledger.id });
      showToast("AI voice call initiated.", "success");
      bumpLedgerRefresh();
    } catch (callError) {
      showToast(
        callError instanceof Error ? callError.message : "Failed to initiate call.",
        "error"
      );
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
      await loadVendor(page);
      showToast(
        communicationPaused ? "Automations paused." : "Automations resumed.",
        "success"
      );
    } catch (toggleError) {
      showToast(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update automation state.",
        "error"
      );
    } finally {
      setTogglingLedgerId(null);
    }
  }

  function handleGenerateSamadhaanKit(ledger: LedgerWithContact) {
    if (!spendFundsEnabled) {
      showToast(
        "You do not have permission to initiate paid transactions.",
        "error"
      );
      return;
    }

    if (!requireCompleteProfile()) {
      return;
    }

    setPendingSamadhaanLedger(ledger);
    setIsSamadhaanConfirmOpen(true);
  }

  async function handleConfirmSamadhaanKit() {
    if (!pendingSamadhaanLedger) {
      return;
    }

    const product = PURCHASE_PRODUCTS.samadhaan_499;
    setIsSamadhaanProcessing(true);
    setMicroTransactionLedgerId(pendingSamadhaanLedger.id);

    try {
      await startRazorpayCheckout({
        purchaseType: "samadhaan_499",
        ledgerId: pendingSamadhaanLedger.id,
        description: `${product.label} — ${pendingSamadhaanLedger.contact.name}`,
        onSuccess: (microFulfillment) => {
          setIsSamadhaanConfirmOpen(false);
          setPendingSamadhaanLedger(null);

          if (!microFulfillment) {
            showToast(
              "Payment received. Samadhaan kit fulfillment is processing.",
              "success"
            );
            void loadVendor(page);
            bumpLedgerRefresh();
            return;
          }

          setSamadhaanFulfillment(microFulfillment);
          setIsSamadhaanModalOpen(true);
          void loadVendor(page);
          bumpLedgerRefresh();
        },
      });
    } catch (checkoutError) {
      if (
        !(checkoutError instanceof Error && checkoutError.message === "Payment cancelled.")
      ) {
        showToast(
          checkoutError instanceof Error
            ? checkoutError.message
            : "Payment could not be completed.",
          "error"
        );
      }
    } finally {
      setIsSamadhaanProcessing(false);
      setMicroTransactionLedgerId(null);
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
      showToast(
        viewError instanceof Error
          ? viewError.message
          : "Failed to open Samadhaan kit.",
        "error"
      );
    } finally {
      setViewingSamadhaanLedgerId(null);
    }
  }

  async function handleViewEvidenceDocket(ledger: LedgerWithContact) {
    setDownloadingEvidenceDocketLedgerId(ledger.id);

    try {
      await openEvidenceDocketPdf(ledger.id);
    } catch (viewError) {
      showToast(
        viewError instanceof Error
          ? viewError.message
          : "Failed to open evidence docket.",
        "error"
      );
    } finally {
      setDownloadingEvidenceDocketLedgerId(null);
    }
  }

  if (isLoading && !contact) {
    return <p className="text-sm text-recoverpe-grey-medium">Loading vendor...</p>;
  }

  if (error || !contact) {
    return <p className="text-sm text-recoverpe-error">{error || "Vendor not found."}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/dashboard/vendors"
            className="text-sm font-medium text-recoverpe-grey-medium hover:text-recoverpe-black"
          >
            ← Vendor Directory
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-recoverpe-black">
            {contact.contact_name}
          </h1>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            {contact.phone_number} · {contact.open_invoice_count} open invoice
            {contact.open_invoice_count === 1 ? "" : "s"}
          </p>
        </div>

        {!readOnly ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() =>
                openLedgerModal({
                  contactName: contact.contact_name,
                  phoneNumber: contact.phone_number.replace(/\D/g, "").slice(-10),
                })
              }
            >
              New Invoice
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAdvanceModalOpen(true)}
            >
              + Log Advance
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-3">
          <WalletBalanceCard
            balance={walletBalance}
            showLogAdvanceAction={!readOnly}
            onLogAdvance={() => setIsAdvanceModalOpen(true)}
          />
          {contactVirtualAccount ? (
            <ContactVirtualAccountCard details={contactVirtualAccount} />
          ) : null}
        </div>
        <HeroMetricCard
          label="Total Due"
          description="Net outstanding across open invoices"
          value={contact.net_outstanding}
        />
        <HeroMetricCard
          label="0-30 Days"
          description="Current and recently due exposure"
          value={contact.bucket_0_30}
        />
        <HeroMetricCard
          label="31-60 Days"
          description="Moderately overdue receivables"
          value={contact.bucket_31_60}
        />
        <HeroMetricCard
          label="90+ Days"
          description="Severely aged outstanding balance"
          value={contact.bucket_90_plus}
        />
      </div>

      <SmartCollectCard
        virtualAccount={virtualAccount}
        businessName={businessName}
        isProvisioning={isProvisioningVirtualAccount}
        isGeneratingPortalLink={isGeneratingPortalLink}
        onProvision={() => void handleProvisionVirtualAccount()}
        onGeneratePortalLink={() => void handleGeneratePortalLink()}
      />

      {!readOnly ? (
        <AssignAgentCard
          contactId={contactId}
          businessId={mode === "personal" ? null : activeBusinessId}
          ledgers={ledgers}
          onAssigned={() => void loadVendor(page)}
        />
      ) : null}

      <div className="border-b border-recoverpe-grey-light">
        <nav className="-mb-px flex gap-2 overflow-x-auto">
          {VENDOR_DETAIL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-recoverpe-black text-recoverpe-black"
                  : "border-transparent text-recoverpe-grey-medium hover:text-recoverpe-black"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "communications" ? (
        <CommunicationHistory contactId={contactId} />
      ) : (
        <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-recoverpe-black">
            Statement of Account
          </h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Invoices tied to this vendor only.
          </p>
        </div>
        {exportEnabled ? (
          <ExportLedgerButton
            ledgers={ledgers}
            filename={`recoverpe-${contact.contact_name.replace(/\s+/g, "-").toLowerCase()}-ledgers.csv`}
          />
        ) : null}
      </div>

      <LedgerTable
        ledgers={ledgers}
        readOnly={readOnly}
        canSendReminders={remindersEnabled}
        canSpendFunds={spendFundsEnabled}
        canViewEvidenceDocket={evidenceDocketEnabled}
        pagination={pagination ?? undefined}
        onPreviousPage={() => void loadVendor(page - 1)}
        onNextPage={() => void loadVendor(page + 1)}
        onViewPdf={(ledger) => setViewLedgerId(ledger.id)}
        onSendReminder={(ledger) => void handleSendReminder(ledger)}
        onSendFromPhone={() => {
          showToast("Use dashboard home for Send from Phone.", "error");
        }}
        onLogOfflinePayment={(ledger) => {
          setPaymentLedger(ledger);
          setIsPaymentModalOpen(true);
        }}
        onInitiateAiCall={(ledger) => void handleInitiateAiCall(ledger)}
        onFileSamadhaan={(ledger) => handleGenerateSamadhaanKit(ledger)}
        onViewSamadhaanDocket={(ledger) => void handleViewSamadhaanDocket(ledger)}
        onViewEvidenceDocket={(ledger) => void handleViewEvidenceDocket(ledger)}
        onToggleAutomationPause={(ledger, paused) =>
          void handleToggleAutomationPause(ledger, paused)
        }
        sendingLedgerId={sendingLedgerId}
        callingLedgerId={callingLedgerId}
        togglingLedgerId={togglingLedgerId}
        microTransactionLedgerId={microTransactionLedgerId}
        viewingSamadhaanLedgerId={viewingSamadhaanLedgerId}
        downloadingEvidenceDocketLedgerId={downloadingEvidenceDocketLedgerId}
      />

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-recoverpe-black">
            Wallet History
          </h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Manual Jama advances credited to this vendor&apos;s khata wallet.
          </p>
        </div>

        {walletTransactions.length === 0 ? (
          <div className="rounded-md border border-dashed border-recoverpe-grey-light px-5 py-8 text-center">
            <p className="text-sm font-medium text-recoverpe-black">
              No wallet advances yet
            </p>
            <p className="mt-2 text-sm text-recoverpe-grey-medium">
              Log an advance to see it recorded here with date, amount, and type.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-recoverpe-grey-light">
            <table className="min-w-full divide-y divide-recoverpe-grey-light text-sm">
              <thead className="bg-recoverpe-grey-light/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-recoverpe-grey-medium">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-recoverpe-grey-medium">
                    Time
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-recoverpe-grey-medium">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-recoverpe-grey-medium">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-recoverpe-grey-light bg-recoverpe-white">
                {walletTransactions.map((transaction) => {
                  const loggedAt = new Date(transaction.logged_at);

                  return (
                    <tr key={transaction.id}>
                      <td className="px-4 py-3 text-recoverpe-black">
                        {new Intl.DateTimeFormat("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(loggedAt)}
                      </td>
                      <td className="px-4 py-3 text-recoverpe-black">
                        {new Intl.DateTimeFormat("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(loggedAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-recoverpe-success">
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-4 py-3 text-recoverpe-black">Advance</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      <LogAdvanceModal
        contactId={contactId}
        contactName={contact.contact_name}
        isOpen={isAdvanceModalOpen}
        onClose={() => setIsAdvanceModalOpen(false)}
        onSuccess={(nextBalance) => {
          setWalletBalance(nextBalance);
          bumpWalletRefresh();
          void loadVendor(page);
          showToast("Advance credited to khata wallet.", "success");
        }}
      />

      <LogOfflinePaymentModal
        ledger={paymentLedger}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentLedger(null);
        }}
        onSuccess={() => {
          void loadVendor(page);
          bumpLedgerRefresh();
        }}
      />

      <MicroTransactionConfirmModal
        purchaseType="samadhaan_499"
        ledger={pendingSamadhaanLedger}
        isOpen={isSamadhaanConfirmOpen}
        isProcessing={isSamadhaanProcessing}
        onClose={() => {
          if (!isSamadhaanProcessing) {
            setIsSamadhaanConfirmOpen(false);
            setPendingSamadhaanLedger(null);
          }
        }}
        onConfirm={() => void handleConfirmSamadhaanKit()}
      />

      <SamadhaanGuideModal
        fulfillment={samadhaanFulfillment}
        isOpen={isSamadhaanModalOpen}
        onClose={() => {
          setIsSamadhaanModalOpen(false);
          setSamadhaanFulfillment(null);
        }}
      />

      {profileUpsellModal}

      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
