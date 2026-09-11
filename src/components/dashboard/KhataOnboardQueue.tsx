"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  approvePendingOnboard,
  fetchPendingOnboards,
} from "@/lib/pending-onboards-client";
import { updateBusinessSettings } from "@/lib/businesses";
import { formatCurrency } from "@/lib/gst";
import { useWorkspaceStore } from "@/store/workspace-store";
import { PendingOnboard } from "@/types";

const POLL_INTERVAL_MS = 30_000;

interface KhataOnboardQueueProps {
  businessId: string;
  businessName: string;
}

export function KhataOnboardQueue({
  businessId,
  businessName,
}: KhataOnboardQueueProps) {
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);
  const setBusinesses = useWorkspaceStore((state) => state.setBusinesses);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const [pendingOnboards, setPendingOnboards] = useState<PendingOnboard[]>([]);
  const [khataAutoApprove, setKhataAutoApprove] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isSavingToggle, setIsSavingToggle] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadQueue = useCallback(async () => {
    try {
      const response = await fetchPendingOnboards(businessId);
      setPendingOnboards(response.pending_onboards);
      setKhataAutoApprove(response.khata_auto_approve);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load onboarding queue."
      );
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadQueue();
    const intervalId = window.setInterval(() => {
      void loadQueue();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadQueue]);

  async function handleToggleAutoApprove() {
    const nextValue = !khataAutoApprove;
    setIsSavingToggle(true);
    setError("");

    try {
      const updatedBusiness = await updateBusinessSettings(businessId, {
        khata_auto_approve: nextValue,
      });
      setKhataAutoApprove(updatedBusiness.khata_auto_approve ?? false);
      setBusinesses(
        businesses.map((business) =>
          business.id === businessId ? updatedBusiness : business
        )
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update auto-approve setting."
      );
    } finally {
      setIsSavingToggle(false);
    }
  }

  async function handleConfirm(
    event: FormEvent<HTMLFormElement>,
    pendingOnboard: PendingOnboard
  ) {
    event.preventDefault();
    setError("");
    setApprovingId(pendingOnboard.id);

    try {
      await approvePendingOnboard(pendingOnboard.id);
      bumpLedgerRefresh();
      await loadQueue();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Failed to confirm customer."
      );
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-recoverpe-black">
              Khata QR Queue
            </h2>
            <p className="mt-1 text-sm text-recoverpe-grey-medium">
              {khataAutoApprove
                ? `${businessName} is auto-approving QR entries instantly.`
                : "Customers waiting at your shop QR. Confirm the amount they entered."}
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-md border border-recoverpe-grey-light px-3 py-2">
            <input
              type="checkbox"
              checked={khataAutoApprove}
              onChange={() => void handleToggleAutoApprove()}
              disabled={isSavingToggle}
              className="h-4 w-4 accent-recoverpe-black"
            />
            <span className="text-sm font-medium text-recoverpe-black">
              Auto-Approve Khata Entries
            </span>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

        {isLoading ? (
          <p className="text-sm text-recoverpe-grey-medium">Loading queue...</p>
        ) : pendingOnboards.length === 0 ? (
          <p className="text-sm text-recoverpe-grey-medium">
            {khataAutoApprove
              ? "No pending customers. New QR scans will become ledgers automatically."
              : "No customers waiting right now."}
          </p>
        ) : (
          pendingOnboards.map((pendingOnboard) => (
            <form
              key={pendingOnboard.id}
              onSubmit={(event) => void handleConfirm(event, pendingOnboard)}
              className="flex flex-col gap-3 border border-recoverpe-grey-light p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-recoverpe-black">
                  {pendingOnboard.customer_name}
                </p>
                <p className="truncate text-sm tabular-nums text-recoverpe-grey-medium">
                  {pendingOnboard.customer_phone}
                </p>
              </div>

              <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                <p className="text-lg font-semibold tabular-nums tracking-tight text-recoverpe-black">
                  {formatCurrency(pendingOnboard.amount)}
                </p>
                <button
                  type="submit"
                  disabled={approvingId === pendingOnboard.id}
                  className="shrink-0 rounded-lg bg-recoverpe-black px-4 py-2.5 text-sm font-medium text-recoverpe-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {approvingId === pendingOnboard.id ? "Confirming..." : "Confirm"}
                </button>
              </div>
            </form>
          ))
        )}
      </CardContent>
    </Card>
  );
}
