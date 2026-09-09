"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InvoiceViewModal } from "@/components/dashboard/InvoiceViewModal";
import { LedgerLegalToolkit } from "@/components/dashboard/LedgerLegalToolkit";
import { LedgerNotes } from "@/components/dashboard/LedgerNotes";
import { MicroTransactionConfirmModal } from "@/components/dashboard/MicroTransactionConfirmModal";
import { SamadhaanGuideModal } from "@/components/dashboard/SamadhaanGuideModal";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { fetchLedgerById } from "@/lib/ledgers";
import { loadSamadhaanFulfillment } from "@/lib/ledger-docket-client";
import { formatCurrency } from "@/lib/gst";
import {
  startRazorpayCheckout,
} from "@/lib/razorpay-client";
import { PURCHASE_PRODUCTS } from "@/lib/razorpay-products";
import {
  canMutateLedgers,
  canSpendFunds,
  canViewEvidenceDocket,
} from "@/lib/workspace-permissions";
import { useWorkspaceStore } from "@/store/workspace-store";
import { LedgerWithContact, MicroTransactionFulfillment } from "@/types";
import { useBusinessProfileUpsell } from "@/hooks/use-business-profile-upsell";

export function GlobalLedgerViewHost() {
  const viewLedgerId = useWorkspaceStore((state) => state.viewLedgerId);
  const setViewLedgerId = useWorkspaceStore((state) => state.setViewLedgerId);
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);
  const readOnly = !canMutateLedgers(workspaceRole, customPermissions);
  const spendFundsEnabled = canSpendFunds(workspaceRole, customPermissions);
  const evidenceDocketEnabled = canViewEvidenceDocket(
    workspaceRole,
    customPermissions
  );
  const { requireCompleteProfile, profileUpsellModal, gateLegalDocuments } =
    useBusinessProfileUpsell();
  const [ledger, setLedger] = useState<LedgerWithContact | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [samadhaanFulfillment, setSamadhaanFulfillment] =
    useState<MicroTransactionFulfillment | null>(null);
  const [isSamadhaanModalOpen, setIsSamadhaanModalOpen] = useState(false);
  const [isSamadhaanConfirmOpen, setIsSamadhaanConfirmOpen] = useState(false);
  const [isSamadhaanProcessing, setIsSamadhaanProcessing] = useState(false);
  const [isViewingSamadhaan, setIsViewingSamadhaan] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!viewLedgerId) {
      setLedger(null);
      setError("");
      return;
    }

    const ledgerId = viewLedgerId;
    let cancelled = false;

    async function loadLedger() {
      setIsLoading(true);
      setError("");

      try {
        const loadedLedger = await fetchLedgerById(ledgerId);
        if (!cancelled) {
          setLedger(loadedLedger);
        }
      } catch (loadError) {
        if (!cancelled) {
          setLedger(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load ledger."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLedger();

    return () => {
      cancelled = true;
    };
  }, [viewLedgerId]);

  function handleClose() {
    setViewLedgerId(null);
    setLedger(null);
    setError("");
    setActionError("");
    setIsSamadhaanConfirmOpen(false);
    setIsSamadhaanModalOpen(false);
    setSamadhaanFulfillment(null);
  }

  async function handleViewSamadhaanKit(targetLedger: LedgerWithContact) {
    if (!requireCompleteProfile()) {
      return;
    }

    setIsViewingSamadhaan(true);
    setActionError("");

    try {
      const fulfillment = await loadSamadhaanFulfillment(targetLedger.id);
      setSamadhaanFulfillment(fulfillment);
      setIsSamadhaanModalOpen(true);
    } catch (viewError) {
      setActionError(
        viewError instanceof Error
          ? viewError.message
          : "Failed to open Samadhaan kit."
      );
    } finally {
      setIsViewingSamadhaan(false);
    }
  }

  function handleGenerateSamadhaanKit(targetLedger: LedgerWithContact) {
    if (!spendFundsEnabled) {
      setActionError("You do not have permission to initiate paid transactions.");
      return;
    }

    if (!requireCompleteProfile()) {
      return;
    }

    setLedger(targetLedger);
    setIsSamadhaanConfirmOpen(true);
  }

  async function handleConfirmSamadhaanKit() {
    if (!ledger) {
      return;
    }

    const product = PURCHASE_PRODUCTS.samadhaan_499;
    setIsSamadhaanProcessing(true);
    setActionError("");

    try {
      await startRazorpayCheckout({
        purchaseType: "samadhaan_499",
        ledgerId: ledger.id,
        description: `${product.label} — ${ledger.contact.name}`,
        onSuccess: (microFulfillment) => {
          setIsSamadhaanConfirmOpen(false);

          if (!microFulfillment) {
            setActionError(
              "Payment received. Samadhaan kit fulfillment is processing."
            );
            bumpLedgerRefresh();
            return;
          }

          setSamadhaanFulfillment(microFulfillment);
          setIsSamadhaanModalOpen(true);
          bumpLedgerRefresh();
        },
      });
    } catch (checkoutError) {
      if (
        !(checkoutError instanceof Error && checkoutError.message === "Payment cancelled.")
      ) {
        setActionError(
          checkoutError instanceof Error
            ? checkoutError.message
            : "Payment could not be completed."
        );
      }
    } finally {
      setIsSamadhaanProcessing(false);
    }
  }

  if (!viewLedgerId) {
    return null;
  }

  if (ledger?.pdf_url) {
    return (
      <>
        <InvoiceViewModal
          ledger={ledger}
          isOpen={Boolean(viewLedgerId)}
          onClose={handleClose}
          canViewEvidenceDocket={evidenceDocketEnabled}
          canSpendFunds={spendFundsEnabled}
          readOnly={readOnly}
          gateLegalDocuments={gateLegalDocuments}
          onProfileIncomplete={() => {
            requireCompleteProfile();
          }}
          onGenerateSamadhaanKit={handleGenerateSamadhaanKit}
          onViewSamadhaanKit={(targetLedger) =>
            void handleViewSamadhaanKit(targetLedger)
          }
          isGeneratingSamadhaan={isSamadhaanProcessing}
          isViewingSamadhaan={isViewingSamadhaan}
        />
        {profileUpsellModal}
        <MicroTransactionConfirmModal
          purchaseType="samadhaan_499"
          ledger={ledger}
          isOpen={isSamadhaanConfirmOpen}
          isProcessing={isSamadhaanProcessing}
          onClose={() => {
            if (!isSamadhaanProcessing) {
              setIsSamadhaanConfirmOpen(false);
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
      </>
    );
  }

  return (
    <>
      <Modal
        isOpen={Boolean(viewLedgerId)}
        onClose={handleClose}
        title={ledger ? ledger.invoice_number ?? "Ledger Entry" : "Ledger Entry"}
      >
        {isLoading ? (
          <p className="text-sm text-recoverpe-grey-medium">Loading ledger...</p>
        ) : error ? (
          <p className="text-sm text-recoverpe-error">{error}</p>
        ) : ledger ? (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-recoverpe-black">
                {ledger.contact.name}
              </p>
              <p className="text-xs text-recoverpe-grey-medium">
                {ledger.contact.phone_number}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-recoverpe-grey-medium">
                  Balance Due
                </p>
                <p className="font-medium tabular-nums text-recoverpe-black">
                  {formatCurrency(ledger.balance_due)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-recoverpe-grey-medium">
                  Due Date
                </p>
                <p className="tabular-nums text-recoverpe-black">{ledger.due_date}</p>
              </div>
            </div>
            <LedgerLegalToolkit
              ledger={ledger}
              canViewEvidenceDocket={evidenceDocketEnabled}
              canSpendFunds={spendFundsEnabled}
              readOnly={readOnly}
              onGenerateSamadhaanKit={handleGenerateSamadhaanKit}
              onViewSamadhaanKit={(targetLedger) =>
                void handleViewSamadhaanKit(targetLedger)
              }
              isGeneratingSamadhaan={isSamadhaanProcessing}
              isViewingSamadhaan={isViewingSamadhaan}
            />
            <LedgerNotes ledgerId={ledger.id} compact />
            {actionError ? (
              <p className="text-sm text-recoverpe-error">{actionError}</p>
            ) : null}
            <Link href={`/dashboard/vendors/${ledger.contact_id}`}>
              <Button type="button" variant="secondary" className="w-full">
                Open Vendor Statement
              </Button>
            </Link>
          </div>
        ) : null}
      </Modal>
      <MicroTransactionConfirmModal
        purchaseType="samadhaan_499"
        ledger={ledger}
        isOpen={isSamadhaanConfirmOpen}
        isProcessing={isSamadhaanProcessing}
        onClose={() => {
          if (!isSamadhaanProcessing) {
            setIsSamadhaanConfirmOpen(false);
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
    </>
  );
}
