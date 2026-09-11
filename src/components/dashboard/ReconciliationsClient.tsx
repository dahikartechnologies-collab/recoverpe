"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/gst";
import {
  ReconciliationQueueEntry,
  fetchReconciliations,
  reviewReconciliation,
} from "@/lib/reconciliations-client";
import { useWorkspaceStore } from "@/store/workspace-store";

interface ToastState {
  message: string;
  variant: "success" | "error";
}

interface ProofPreview {
  url: string;
  contactName: string;
}

function ProofThumbnail({
  entry,
  onOpen,
}: {
  entry: ReconciliationQueueEntry;
  onOpen: () => void;
}) {
  if (!entry.proof_url) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-dashed border-recoverpe-grey-light text-center text-[10px] leading-tight text-recoverpe-grey-medium">
        No image
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring block h-14 w-14 overflow-hidden rounded-sm border border-recoverpe-grey-light transition-all duration-200 ease-out hover:opacity-80"
      aria-label={`View payment proof from ${entry.contact_name ?? "customer"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not a static asset */}
      <img
        src={entry.proof_url}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </button>
  );
}

function ProofViewer({
  preview,
  onClose,
}: {
  preview: ProofPreview;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Payment proof"
      className="fixed inset-0 z-50 flex items-center justify-center bg-recoverpe-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-2xl overflow-auto rounded-lg border border-recoverpe-grey-light bg-recoverpe-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-recoverpe-grey-light px-4 py-3">
          <p className="text-sm font-medium text-recoverpe-black">
            Payment proof — {preview.contactName}
          </p>
          <div className="flex items-center gap-2">
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded-sm text-sm font-medium text-recoverpe-black underline underline-offset-2"
            >
              Open original
            </a>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="min-h-9 px-3 py-1.5 text-xs"
            >
              Close
            </Button>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not a static asset */}
        <img
          src={preview.url}
          alt={`Payment proof from ${preview.contactName}`}
          className="w-full bg-recoverpe-grey-light/30 object-contain"
        />
      </div>
    </div>
  );
}

function formatSubmittedAt(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function ReconciliationsClient() {
  const mode = useWorkspaceStore((state) => state.mode);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);
  const [entries, setEntries] = useState<ReconciliationQueueEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [preview, setPreview] = useState<ProofPreview | null>(null);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setEntries(await fetchReconciliations("pending_review"));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load reconciliations."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue, mode, activeBusinessId]);

  async function handleReview(
    entry: ReconciliationQueueEntry,
    action: "approve" | "reject"
  ) {
    setPendingId(entry.id);

    try {
      const { settled_amount } = await reviewReconciliation(entry.id, action);

      setEntries((current) => current.filter((item) => item.id !== entry.id));
      bumpLedgerRefresh();
      setToast({
        variant: "success",
        message:
          action === "approve"
            ? `Settled ${formatCurrency(settled_amount)} against the ledger.`
            : "Claim rejected and the customer has been notified.",
      });
    } catch (reviewError) {
      setToast({
        variant: "error",
        message:
          reviewError instanceof Error
            ? reviewError.message
            : "Failed to review this claim.",
      });
      // A 409 means someone else already actioned it, so resync the queue.
      void loadQueue();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-recoverpe-black">
          Payment Proofs
        </h1>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Screenshots customers sent on WhatsApp, read automatically. Nothing is
          settled until you approve it.
        </p>
      </div>

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-recoverpe-grey-medium">Loading claims...</p>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium text-recoverpe-black">
              No payment proofs waiting for review
            </p>
            <p className="mt-1 text-sm text-recoverpe-grey-medium">
              When a customer sends a payment screenshot on WhatsApp, it will
              appear here for your approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-recoverpe-grey-light">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-recoverpe-grey-light/40">
              <tr>
                <th className="px-4 py-3 font-medium text-recoverpe-black">
                  Proof
                </th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">
                  Received
                </th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">
                  Customer
                </th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">UTR</th>
                <th className="px-4 py-3 text-right font-medium text-recoverpe-black">
                  Amount
                </th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">
                  Suggested invoice
                </th>
                <th className="px-4 py-3 text-right font-medium text-recoverpe-black">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-recoverpe-grey-light bg-recoverpe-white">
              {entries.map((entry) => {
                const isBusy = pendingId === entry.id;
                const canSettle =
                  Boolean(entry.ledger_id) &&
                  entry.extracted_amount !== null &&
                  entry.extracted_amount > 0;

                return (
                  <tr key={entry.id}>
                    <td className="px-4 py-3">
                      <ProofThumbnail
                        entry={entry}
                        onOpen={() =>
                          entry.proof_url &&
                          setPreview({
                            url: entry.proof_url,
                            contactName: entry.contact_name ?? "Unknown",
                          })
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-recoverpe-grey-medium">
                      {formatSubmittedAt(entry.created_at)}
                    </td>
                    <td className="px-4 py-3 text-recoverpe-black">
                      {entry.contact_name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-recoverpe-black">
                      {entry.extracted_utr ?? (
                        <span className="font-sans text-recoverpe-grey-medium">
                          Not detected
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-recoverpe-black">
                      {entry.extracted_amount !== null ? (
                        formatCurrency(entry.extracted_amount)
                      ) : (
                        <span className="font-normal text-recoverpe-grey-medium">
                          Not detected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.suggested_invoice ? (
                        <>
                          <p className="text-recoverpe-black">
                            {entry.suggested_invoice}
                          </p>
                          {entry.suggested_invoice_balance !== null ? (
                            <p className="mt-0.5 text-xs text-recoverpe-grey-medium">
                              {formatCurrency(entry.suggested_invoice_balance)} due
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-recoverpe-grey-medium">
                          No open invoice
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          onClick={() => void handleReview(entry, "approve")}
                          disabled={isBusy || !canSettle}
                          title={
                            canSettle
                              ? undefined
                              : "Needs a detected amount and an open invoice"
                          }
                          className="min-h-9 px-3 py-1.5 text-xs"
                        >
                          {isBusy ? "Working..." : "Approve & Settle"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void handleReview(entry, "reject")}
                          disabled={isBusy}
                          className="min-h-9 px-3 py-1.5 text-xs"
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {preview ? (
        <ProofViewer preview={preview} onClose={() => setPreview(null)} />
      ) : null}

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
