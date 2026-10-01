"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { LegalNoticePreviewModal } from "@/components/dashboard/LegalNoticePreviewModal";
import { LegalNoticeSuccessModal } from "@/components/dashboard/LegalNoticeSuccessModal";
import { fetchAutopilotAlerts } from "@/lib/autopilot-alerts-client";
import { fetchLedgerById } from "@/lib/ledgers";
import { startRazorpayCheckout } from "@/lib/razorpay-client";
import { PURCHASE_PRODUCTS } from "@/lib/razorpay-products";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  AutopilotEscalationAlert,
  MicroTransactionFulfillment,
} from "@/types";

interface AutopilotEscalationAlertsState {
  alerts: AutopilotEscalationAlert[];
  isLoading: boolean;
  openAlert: (alert: AutopilotEscalationAlert) => void;
  modals: ReactNode;
}

/**
 * Legal escalation alerts plus the ₹999 notice preview/checkout flow. The
 * caller decides where the alerts surface and must render `modals`.
 */
export function useAutopilotEscalationAlerts(): AutopilotEscalationAlertsState {
  const mode = useWorkspaceStore((state) => state.mode);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const ledgerRefreshKey = useWorkspaceStore((state) => state.ledgerRefreshKey);
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);

  const [alerts, setAlerts] = useState<AutopilotEscalationAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] =
    useState<AutopilotEscalationAlert | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [legalNoticeFulfillment, setLegalNoticeFulfillment] =
    useState<MicroTransactionFulfillment | null>(null);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);

    try {
      if (mode === "business" && !activeBusinessId) {
        setAlerts([]);
        return;
      }

      const data = await fetchAutopilotAlerts(
        mode,
        mode === "business" ? activeBusinessId : null
      );
      setAlerts(data);
    } catch {
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, [mode, activeBusinessId]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts, ledgerRefreshKey]);

  const openAlert = useCallback((alert: AutopilotEscalationAlert) => {
    setSelectedAlert(alert);
    setIsPreviewOpen(true);
  }, []);

  async function handleGenerateNotice() {
    if (!selectedAlert) {
      return;
    }

    setIsProcessing(true);

    try {
      const ledger = await fetchLedgerById(selectedAlert.ledger_id);
      const product = PURCHASE_PRODUCTS.legal_notice_999;

      await startRazorpayCheckout({
        purchaseType: "legal_notice_999",
        ledgerId: ledger.id,
        description: `${product.label} — ${ledger.contact.name}`,
        onSuccess: (fulfillment) => {
          setIsPreviewOpen(false);
          setSelectedAlert(null);

          if (fulfillment) {
            setLegalNoticeFulfillment(fulfillment);
            setIsSuccessOpen(true);
          }

          bumpLedgerRefresh();
          void loadAlerts();
        },
      });
    } finally {
      setIsProcessing(false);
    }
  }

  const modals = (
    <>
      <LegalNoticePreviewModal
        alert={selectedAlert}
        isOpen={isPreviewOpen}
        isProcessing={isProcessing}
        onClose={() => {
          if (!isProcessing) {
            setIsPreviewOpen(false);
            setSelectedAlert(null);
          }
        }}
        onGenerate={() => void handleGenerateNotice()}
      />

      <LegalNoticeSuccessModal
        fulfillment={legalNoticeFulfillment}
        isOpen={isSuccessOpen}
        onClose={() => {
          setIsSuccessOpen(false);
          setLegalNoticeFulfillment(null);
        }}
      />
    </>
  );

  return { alerts, isLoading, openAlert, modals };
}
