"use client";

import { useCallback, useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
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
      <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-recoverpe-line text-center text-[10px] leading-tight text-recoverpe-muted">
        No image
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring rp-interactive block h-14 w-14 overflow-hidden rounded-md border border-recoverpe-line hover:opacity-80"
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
        className="max-h-full w-full max-w-2xl overflow-auto rounded-xl border border-recoverpe-line bg-recoverpe-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-recoverpe-line px-4 py-3">
          <p className="text-sm font-medium text-recoverpe-black">
            Payment proof — {preview.contactName}
          </p>
          <div className="flex items-center gap-2">
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded-md text-sm font-medium text-recoverpe-black underline underline-offset-2"
            >
              Open original
            </a>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not a static asset */}
        <img
          src={preview.url}
          alt={`Payment proof from ${preview.contactName}`}
          className="w-full bg-[var(--rp-fill)] object-contain"
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

function ReconciliationsTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Proof</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>UTR</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Suggested invoice</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 4 }).map((_, index) => (
              <TableRow key={index} className="pointer-events-none">
                <TableCell colSpan={7}>
                  <div className="h-4 animate-pulse rounded bg-[var(--rp-fill)]" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
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
      <PageHeader
        title="Payment Proofs"
        description="Screenshots customers sent on WhatsApp, read automatically. Nothing is settled until you approve it."
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {isLoading ? (
        <ReconciliationsTableSkeleton />
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<ScanLine className="h-5 w-5" aria-hidden />}
              title="No payment proofs waiting for review"
              description="When a customer sends a payment screenshot on WhatsApp, it will appear here for your approval."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Proof</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>UTR</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Suggested invoice</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const isBusy = pendingId === entry.id;
                  const canSettle =
                    Boolean(entry.ledger_id) &&
                    entry.extracted_amount !== null &&
                    entry.extracted_amount > 0;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-recoverpe-muted">
                        {formatSubmittedAt(entry.created_at)}
                      </TableCell>
                      <TableCell className="text-recoverpe-black">
                        {entry.contact_name ?? "Unknown"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-recoverpe-black">
                        {entry.extracted_utr ?? (
                          <span className="font-sans text-recoverpe-muted">
                            Not detected
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right type-data-primary">
                        {entry.extracted_amount !== null ? (
                          formatCurrency(entry.extracted_amount)
                        ) : (
                          <span className="font-normal text-recoverpe-muted">
                            Not detected
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.suggested_invoice ? (
                          <>
                            <p className="text-recoverpe-black">
                              {entry.suggested_invoice}
                            </p>
                            {entry.suggested_invoice_balance !== null ? (
                              <p className="type-data-secondary mt-0.5">
                                {formatCurrency(entry.suggested_invoice_balance)}{" "}
                                due
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <Badge tone="neutral">No open invoice</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleReview(entry, "approve")}
                            disabled={isBusy || !canSettle}
                            title={
                              canSettle
                                ? undefined
                                : "Needs a detected amount and an open invoice"
                            }
                          >
                            {isBusy ? "Working..." : "Approve & Settle"}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => void handleReview(entry, "reject")}
                            disabled={isBusy}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
