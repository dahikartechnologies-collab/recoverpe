"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShopQrDownloadButton } from "@/components/dashboard/ShopQrDownloadButton";
import { VendorTableSkeleton } from "@/components/dashboard/VendorTableSkeleton";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchVendorDirectory } from "@/lib/vendor-client";
import { downloadVendorsCsv } from "@/lib/vendor-export";
import { formatCurrency } from "@/lib/gst";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ContactDirectoryEntry } from "@/types";

const PAGE_SIZE = 50;

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default function VendorsPage() {
  const mode = useWorkspaceStore((state) => state.mode);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;
  const [contacts, setContacts] = useState<ContactDirectoryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadDirectory = useCallback(
    async (targetPage: number) => {
      if (mode === "business" && !activeBusinessId) {
        setContacts([]);
        setTotal(0);
        setHasMore(false);
        setIsLoading(false);
        setError("Select a business workspace to view its vendor directory.");
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await fetchVendorDirectory({
          page: targetPage,
          limit: PAGE_SIZE,
          businessId: mode === "personal" ? null : activeBusinessId,
          workspaceMode: mode,
        });
        setContacts(response.contacts);
        setPage(response.pagination.page);
        setTotal(response.pagination.total);
        setHasMore(response.pagination.hasMore);
      } catch (loadError) {
        setContacts([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load vendor directory."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [mode, activeBusinessId]
  );

  useEffect(() => {
    void loadDirectory(1);
  }, [loadDirectory]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => contacts.some((contact) => contact.contact_id === id))
    );
  }, [contacts]);

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedIds.includes(contact.contact_id)),
    [contacts, selectedIds]
  );

  const allVisibleSelected =
    contacts.length > 0 &&
    contacts.every((contact) => selectedIds.includes(contact.contact_id));

  function toggleContactSelection(contactId: string) {
    setSelectedIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId]
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(contacts.map((contact) => contact.contact_id));
  }

  function handleExportSelected() {
    if (selectedContacts.length === 0) {
      return;
    }

    downloadVendorsCsv(
      selectedContacts,
      `vendors-export-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="type-eyebrow">Enterprise</p>
          <h1 className="type-page-title mt-2">Vendor Directory</h1>
          <p className="type-data-secondary mt-3 max-w-2xl text-sm leading-relaxed">
            Aggregated exposure by contact with open invoice counts and aging
            buckets for your active workspace.
          </p>
        </div>

        {mode === "business" && activeBusiness ? (
          <ShopQrDownloadButton
            businessId={activeBusiness.id}
            businessName={activeBusiness.business_name}
          />
        ) : null}
      </div>

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      {isLoading ? (
        <VendorTableSkeleton />
      ) : (
        <>
          <BulkActionBar
            selectedCount={selectedIds.length}
            onClearSelection={() => setSelectedIds([])}
            onExportCsv={handleExportSelected}
          />

          <Card>
            <CardContent className="p-0">
              {contacts.length === 0 ? (
                <EmptyState
                  title="No vendors yet"
                  description="Add ledger entries or import CSV data to populate your vendor directory with outstanding balances."
                />
              ) : (
                <>
                  <div className="md:hidden flex flex-col space-y-4 p-4">
                    {contacts.map((contact) => {
                      const isSelected = selectedIds.includes(contact.contact_id);
                      const walletTone =
                        contact.wallet_balance > 0
                          ? "text-recoverpe-success"
                          : contact.net_outstanding > 0
                            ? "text-orange-600"
                            : "text-recoverpe-grey-medium";

                      return (
                        <div
                          key={contact.contact_id}
                          className="rounded-md border border-recoverpe-grey-light p-4 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <input
                                type="checkbox"
                                aria-label={`Select ${contact.contact_name}`}
                                checked={isSelected}
                                onChange={() =>
                                  toggleContactSelection(contact.contact_id)
                                }
                                className="focus-ring mt-0.5 h-4 w-4 shrink-0 rounded border-recoverpe-grey-light"
                              />
                              <div className="min-w-0">
                                <Link
                                  href={`/dashboard/vendors/${contact.contact_id}`}
                                  className="focus-ring block truncate text-sm font-semibold text-recoverpe-black"
                                >
                                  {contact.contact_name}
                                </Link>
                                <p className="type-data-secondary mt-1 truncate text-xs">
                                  {contact.phone_number}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                                Wallet
                              </p>
                              <p className={`text-sm font-semibold tabular-nums ${walletTone}`}>
                                {formatCurrency(contact.wallet_balance)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-recoverpe-grey-light pt-3 text-xs">
                            <span className="text-recoverpe-grey-medium">
                              {formatCount(contact.open_invoice_count)} open
                            </span>
                            <span className="font-medium text-recoverpe-black">
                              {formatCurrency(contact.net_outstanding)} due
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-recoverpe-grey-light bg-recoverpe-grey-light/60">
                        <th className="w-10 px-5 py-3">
                          <input
                            type="checkbox"
                            aria-label="Select all visible vendors"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            className="focus-ring h-4 w-4 rounded border-recoverpe-grey-light"
                          />
                        </th>
                        <th className="type-table-header px-5 py-3 text-left">Vendor</th>
                        <th className="type-table-header px-5 py-3 text-left">
                          Open Invoices
                        </th>
                        <th className="type-table-header max-w-[10rem] px-5 py-3 text-left">
                          Net Outstanding
                        </th>
                        <th className="type-table-header max-w-[10rem] px-5 py-3 text-left">
                          90+ Days
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact) => (
                        <tr
                          key={contact.contact_id}
                          className="group border-b border-recoverpe-grey-light transition-all duration-200 ease-out last:border-b-0 hover:bg-recoverpe-grey-light/50"
                        >
                          <td className="px-5 py-4 align-middle">
                            <input
                              type="checkbox"
                              aria-label={`Select ${contact.contact_name}`}
                              checked={selectedIds.includes(contact.contact_id)}
                              onChange={() => toggleContactSelection(contact.contact_id)}
                              className="focus-ring h-4 w-4 rounded border-recoverpe-grey-light"
                            />
                          </td>
                          <td className="min-w-0 max-w-[14rem] px-5 py-4 align-middle">
                            <Link
                              href={`/dashboard/vendors/${contact.contact_id}`}
                              className="focus-ring block truncate rounded-sm text-sm font-semibold text-recoverpe-black transition-all duration-200 ease-out hover:underline"
                            >
                              {contact.contact_name}
                            </Link>
                            <p className="type-data-secondary mt-1 truncate">
                              {contact.phone_number}
                            </p>
                          </td>
                          <td className="type-data-secondary px-5 py-4 align-middle text-sm">
                            {formatCount(contact.open_invoice_count)}
                          </td>
                          <td className="max-w-[10rem] px-5 py-4 align-middle">
                            <span className="type-data-primary block truncate text-sm">
                              {formatCurrency(contact.net_outstanding)}
                            </span>
                          </td>
                          <td className="max-w-[10rem] px-5 py-4 align-middle">
                            <span className="type-data-primary block truncate text-sm">
                              {formatCurrency(contact.bucket_90_plus)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}

              {total > PAGE_SIZE ? (
                <div className="flex items-center justify-between border-t border-recoverpe-grey-light px-5 py-4">
                  <p className="type-data-secondary text-xs">
                    Showing {start}–{end} of {formatCount(total)}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadDirectory(page - 1)}
                      disabled={page <= 1}
                      className="focus-ring rounded-md border border-recoverpe-black px-3 py-1.5 text-xs font-medium text-recoverpe-black transition-all duration-200 ease-out enabled:hover:bg-recoverpe-grey-light disabled:cursor-not-allowed disabled:border-recoverpe-grey-light disabled:text-recoverpe-grey-medium"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadDirectory(page + 1)}
                      disabled={!hasMore}
                      className="focus-ring rounded-md border border-recoverpe-black px-3 py-1.5 text-xs font-medium text-recoverpe-black transition-all duration-200 ease-out enabled:hover:bg-recoverpe-grey-light disabled:cursor-not-allowed disabled:border-recoverpe-grey-light disabled:text-recoverpe-grey-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
