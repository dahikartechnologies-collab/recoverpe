"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
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

export function AutopilotAlerts() {
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

  if (isLoading || alerts.length === 0) {
    return null;
  }

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

  return (
    <>
      <section className="space-y-3">
        {alerts.map((alert) => (
          <button
            key={alert.ledger_id}
            type="button"
            onClick={() => {
              setSelectedAlert(alert);
              setIsPreviewOpen(true);
            }}
            className="focus-ring flex w-full items-start gap-3 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-left transition-colors hover:bg-orange-100/80"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-orange-600"
              aria-hidden
            />
            <div>
              <p className="text-sm font-semibold text-orange-700">
                Final Warning Sent. Legal escalation ready for {alert.contact_name}.
              </p>
              <p className="mt-1 text-xs text-orange-600/90">
                Tap to preview and issue the official ₹999 legal notice.
              </p>
            </div>
          </button>
        ))}
      </section>

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
}
