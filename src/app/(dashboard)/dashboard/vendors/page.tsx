"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShopQrDownloadButton } from "@/components/dashboard/ShopQrDownloadButton";
import { VendorTableSkeleton } from "@/components/dashboard/VendorTableSkeleton";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
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
import { fetchVendorDirectory } from "@/lib/vendor-client";
import { downloadVendorsCsv } from "@/lib/vendor-export";
import { formatCurrency } from "@/lib/gst";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ContactDirectoryEntry } from "@/types";

const PAGE_SIZE = 50;
const AMOUNT_CLASS = "font-mono tabular-nums tracking-tight text-recoverpe-black";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function walletAmountClass(contact: ContactDirectoryEntry): string {
  if (contact.wallet_balance > 0) {
    return "font-mono tabular-nums tracking-tight text-recoverpe-success-ink";
  }
  if (contact.net_outstanding > 0) {
    return "font-mono tabular-nums tracking-tight text-recoverpe-danger-ink";
  }
  return "font-mono tabular-nums tracking-tight text-recoverpe-muted";
}

export default function VendorsPage() {
  const router = useRouter();
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
      <PageHeader
        eyebrow="Enterprise"
        title="Vendor Directory"
        description="Aggregated exposure by contact with open invoice counts and aging buckets for your active workspace."
        actions={
          mode === "business" && activeBusiness ? (
            <ShopQrDownloadButton
              businessId={activeBusiness.id}
              businessName={activeBusiness.business_name}
            />
          ) : null
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

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
                  <div className="flex flex-col space-y-4 p-4 md:hidden">
                    {contacts.map((contact) => {
                      const isSelected = selectedIds.includes(contact.contact_id);

                      return (
                        <div
                          key={contact.contact_id}
                          className="rounded-xl border border-recoverpe-line p-4"
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
                                className="focus-ring mt-0.5 h-4 w-4 shrink-0 rounded border-recoverpe-line"
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
                              <p className="type-eyebrow">Wallet</p>
                              <p className={`mt-1 text-sm ${walletAmountClass(contact)}`}>
                                {formatCurrency(contact.wallet_balance)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-recoverpe-line pt-3 text-xs">
                            <Badge
                              tone={
                                contact.open_invoice_count > 0 ? "warning" : "neutral"
                              }
                            >
                              {formatCount(contact.open_invoice_count)} open
                            </Badge>
                            <span className={AMOUNT_CLASS}>
                              {formatCurrency(contact.net_outstanding)} due
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              aria-label="Select all visible vendors"
                              checked={allVisibleSelected}
                              onChange={toggleSelectAllVisible}
                              className="focus-ring h-4 w-4 rounded border-recoverpe-line"
                            />
                          </TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Open Invoices</TableHead>
                          <TableHead>Net Outstanding</TableHead>
                          <TableHead>90+ Days</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((contact) => (
                          <TableRow key={contact.contact_id} className="group">
                            <TableCell>
                              <input
                                type="checkbox"
                                aria-label={`Select ${contact.contact_name}`}
                                checked={selectedIds.includes(contact.contact_id)}
                                onChange={() =>
                                  toggleContactSelection(contact.contact_id)
                                }
                                className="focus-ring h-4 w-4 rounded border-recoverpe-line"
                              />
                            </TableCell>
                            <TableCell className="min-w-0 max-w-[14rem]">
                              <Link
                                href={`/dashboard/vendors/${contact.contact_id}`}
                                className="focus-ring rp-interactive block truncate rounded-sm text-sm font-semibold text-recoverpe-black hover:underline"
                              >
                                {contact.contact_name}
                              </Link>
                              <p className="type-data-secondary mt-1 truncate">
                                {contact.phone_number}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge
                                tone={
                                  contact.open_invoice_count > 0
                                    ? "warning"
                                    : "neutral"
                                }
                              >
                                {formatCount(contact.open_invoice_count)}
                              </Badge>
                            </TableCell>
                            <TableCell className={AMOUNT_CLASS}>
                              {formatCurrency(contact.net_outstanding)}
                            </TableCell>
                            <TableCell>
                              {contact.bucket_90_plus > 0 ? (
                                <span className="font-mono tabular-nums tracking-tight text-recoverpe-danger-ink">
                                  {formatCurrency(contact.bucket_90_plus)}
                                </span>
                              ) : (
                                <span className="font-mono tabular-nums tracking-tight text-recoverpe-muted">
                                  {formatCurrency(contact.bucket_90_plus)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                                onClick={() =>
                                  router.push(
                                    `/dashboard/vendors/${contact.contact_id}`
                                  )
                                }
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {total > PAGE_SIZE ? (
                <div className="flex items-center justify-between border-t border-recoverpe-line px-5 py-4">
                  <p className="type-data-secondary text-xs">
                    Showing {start}–{end} of {formatCount(total)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void loadDirectory(page - 1)}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void loadDirectory(page + 1)}
                      disabled={!hasMore}
                    >
                      Next
                    </Button>
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
