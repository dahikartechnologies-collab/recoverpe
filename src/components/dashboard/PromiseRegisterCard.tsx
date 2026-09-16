"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import {
  fetchPaymentPromises,
  updatePaymentPromiseStatus,
} from "@/lib/promises-client";
import { PaymentPromiseRecord, PromiseStatus } from "@/types";

interface PromiseRegisterCardProps {
  businessId: string;
}

type PromiseTab = "open" | "kept" | "broken";

interface ToastState {
  message: string;
  variant: "success" | "error";
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const TAB_LABELS: Record<PromiseTab, string> = {
  open: "Open",
  kept: "Kept",
  broken: "Broken",
};

export function PromiseRegisterCard({ businessId }: PromiseRegisterCardProps) {
  const [activeTab, setActiveTab] = useState<PromiseTab>("open");
  const [promises, setPromises] = useState<PaymentPromiseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const loadPromises = useCallback(async () => {
    setIsLoading(true);

    try {
      const rows = await fetchPaymentPromises(businessId, activeTab as PromiseStatus);
      setPromises(rows);
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : "Failed to load promises.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, businessId]);

  useEffect(() => {
    void loadPromises();
  }, [loadPromises]);

  const countsLabel = useMemo(
    () => `${promises.length} ${TAB_LABELS[activeTab].toLowerCase()} promise(s)`,
    [activeTab, promises.length]
  );

  async function handleStatusUpdate(
    promiseId: string,
    status: Extract<PromiseStatus, "kept" | "broken">
  ) {
    setPendingId(promiseId);
    setToast(null);

    try {
      await updatePaymentPromiseStatus(promiseId, status);
      setToast({
        message: `Promise marked as ${status}.`,
        variant: "success",
      });
      await loadPromises();
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : "Failed to update promise.",
        variant: "error",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="type-eyebrow">Promise Register</p>
        <h2 className="type-section-title mt-2">Verbal pay-by dates from WhatsApp</h2>
        <p className="type-data-secondary mt-2 text-sm">
          Inbound Gemini extracts promises like &quot;Friday&quot; or &quot;kal dunga&quot;.
          Broken promises roll over after IST midnight.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as PromiseTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
                  : "border-recoverpe-grey-light bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <p className="text-xs text-recoverpe-grey-medium">{countsLabel}</p>

        {isLoading ? (
          <p className="text-sm text-recoverpe-grey-medium">Loading promises...</p>
        ) : promises.length === 0 ? (
          <p className="text-sm text-recoverpe-grey-medium">
            No {TAB_LABELS[activeTab].toLowerCase()} promises for this business yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-recoverpe-grey-light bg-recoverpe-grey-light/40">
                <tr>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Promised on</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  {activeTab === "open" ? (
                    <th className="px-3 py-2 font-medium">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {promises.map((promise) => (
                  <tr
                    key={promise.id}
                    className="border-b border-recoverpe-grey-light last:border-b-0"
                  >
                    <td className="px-3 py-3 text-recoverpe-black">
                      {promise.contact_name ?? promise.contact_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-3 text-recoverpe-grey-medium">
                      {formatDate(promise.promised_on)}
                    </td>
                    <td className="px-3 py-3 text-recoverpe-black">
                      {formatAmount(promise.promised_amount)}
                    </td>
                    <td className="px-3 py-3 capitalize text-recoverpe-grey-medium">
                      {promise.source}
                    </td>
                    {activeTab === "open" ? (
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={pendingId === promise.id}
                            onClick={() =>
                              void handleStatusUpdate(promise.id, "kept")
                            }
                          >
                            Kept
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={pendingId === promise.id}
                            onClick={() =>
                              void handleStatusUpdate(promise.id, "broken")
                            }
                          >
                            Broken
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      ) : null}
    </Card>
  );
}
