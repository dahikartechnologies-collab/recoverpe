"use client";

import { useCallback, useEffect, useState } from "react";
import { CashCollectionDrawer } from "@/components/kiosk/CashCollectionDrawer";
import { fetchKioskAssignments } from "@/lib/kiosk-client";
import { KioskVendorAssignment } from "@/types";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function KioskPage() {
  const [vendors, setVendors] = useState<KioskVendorAssignment[]>([]);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] =
    useState<KioskVendorAssignment | null>(null);

  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const data = await fetchKioskAssignments();
      setVendors(data.vendors);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load assigned vendors."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-recoverpe-black">
          Your vendors
        </h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Tap a vendor to log a collection.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-recoverpe-grey-medium">Loading vendors...</p>
      ) : null}

      {loadError ? (
        <p className="rounded-lg border border-recoverpe-error px-4 py-3 text-sm text-recoverpe-error">
          {loadError}
        </p>
      ) : null}

      {!isLoading && !loadError && vendors.length === 0 ? (
        <div className="rounded-lg border border-recoverpe-grey-light px-4 py-8 text-center">
          <p className="text-base font-medium text-recoverpe-black">
            No assigned vendors
          </p>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            Your manager has not assigned any open invoices to you yet.
          </p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {vendors.map((vendor) => (
          <li key={vendor.contact_id}>
            <button
              type="button"
              onClick={() => setSelectedVendor(vendor)}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-recoverpe-grey-light px-4 py-5 text-left active:border-recoverpe-black"
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-recoverpe-black">
                  {vendor.contact_name}
                </p>
                <p className="mt-1 text-sm text-recoverpe-grey-medium">
                  {vendor.ledgers.length} open invoice
                  {vendor.ledgers.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                  Outstanding
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-recoverpe-black">
                  {formatCurrency(vendor.total_outstanding)}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <CashCollectionDrawer
        vendor={selectedVendor}
        isOpen={Boolean(selectedVendor)}
        onClose={() => setSelectedVendor(null)}
        onSuccess={() => {
          setSelectedVendor(null);
          void loadAssignments();
        }}
      />
    </div>
  );
}
