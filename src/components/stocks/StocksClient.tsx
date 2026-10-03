"use client";

import {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Boxes, Camera, Mic, Package, Plus, Wallet } from "lucide-react";
import { AddStockItemModal } from "@/components/stocks/AddStockItemModal";
import { AdjustStockModal } from "@/components/stocks/AdjustStockModal";
import { ConversationalCheckoutModal } from "@/components/stocks/ConversationalCheckoutModal";
import { FlashSaleModal } from "@/components/stocks/FlashSaleModal";
import { ParchiReviewDrawer } from "@/components/stocks/ParchiReviewDrawer";
import { StockHistoryModal } from "@/components/stocks/StockHistoryModal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCards } from "@/components/dashboard/MetricCardSkeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatCurrency } from "@/lib/gst";
import {
  fetchParchiInbox,
  fetchStockDashboard,
  uploadParchi,
} from "@/lib/smart-stocks/client";
import {
  normalizeParchiExtraction,
  ParchiInboxEntry,
  StockDashboardItem,
  StockDashboardResponse,
} from "@/lib/smart-stocks/shared";
import { useWorkspaceStore } from "@/store/workspace-store";
import { StockItemRow } from "@/types";

const PARCHI_MAX_BYTES = 4 * 1024 * 1024;
const PARCHI_ACCEPT = "image/jpeg,image/png,image/webp";
const AMOUNT_CLASS = "font-mono tabular-nums tracking-tight text-recoverpe-black";

function formatQty(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(value);
}

function formatShortDate(value: string): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone?: "neutral" | "danger" | "warning";
}) {
  const valueClass =
    tone === "danger"
      ? "text-recoverpe-danger-ink"
      : tone === "warning"
        ? "text-recoverpe-warning-ink"
        : "text-recoverpe-black";

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="min-w-0 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="type-eyebrow truncate">{label}</p>
          <span className="text-recoverpe-muted">{icon}</span>
        </div>
        <p className={`type-stat mt-3 truncate ${valueClass}`}>{value}</p>
        <p className="type-data-secondary mt-2 leading-relaxed">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function StocksClient() {
  const mode = useWorkspaceStore((state) => state.mode);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;
  const businessId = mode === "business" ? activeBusinessId : null;

  const [dashboard, setDashboard] = useState<StockDashboardResponse | null>(null);
  const [inbox, setInbox] = useState<ParchiInboxEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [reviewCapture, setReviewCapture] = useState<ParchiInboxEntry | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<StockItemRow | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItemRow | null>(null);
  const [flashItem, setFlashItem] = useState<StockDashboardItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!businessId) {
      setDashboard(null);
      setInbox([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const [dashboardResponse, inboxResponse] = await Promise.all([
        fetchStockDashboard(businessId),
        fetchParchiInbox(businessId),
      ]);
      setDashboard(dashboardResponse);
      setInbox(inboxResponse.captures);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load stock.");
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => dashboard?.items ?? [], [dashboard]);
  const deadItems = useMemo(
    () =>
      items
        .filter((item) => item.is_dead_stock)
        .sort((left, right) => right.stock_value - left.stock_value),
    [items]
  );

  async function handleParchiSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !businessId) {
      return;
    }

    if (file.size > PARCHI_MAX_BYTES) {
      setError("Parchi photo must be under 4MB. Retake it at a lower resolution.");
      return;
    }

    setError("");
    setNotice("");
    setIsUploading(true);

    try {
      const { document_capture: capture } = await uploadParchi(businessId, file);
      const { captures } = await fetchParchiInbox(businessId);
      setInbox(captures);
      setReviewCapture(
        captures.find((entry) => entry.id === capture.id) ?? {
          ...capture,
          view_url: capture.photo_url,
        }
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Failed to read the parchi."
      );
    } finally {
      setIsUploading(false);
    }
  }

  if (mode !== "business" || !businessId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stocks" description="Inventory, supplier bills and dead stock." />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Boxes className="h-5 w-5" aria-hidden />}
              title="Select a business"
              description="Stock is tracked per business. Switch to a business workspace to manage inventory."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const metrics = dashboard?.metrics;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Smart Stocks"
        title="Stocks"
        description="Inventory value, low stock, supplier credit and the cash trapped in slow-moving items."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setIsVoiceOpen(true)}>
              <Mic className="mr-1.5 h-4 w-4" aria-hidden />
              Voice sale
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Camera className="mr-1.5 h-4 w-4" aria-hidden />
              {isUploading ? "Reading parchi..." : "Scan Parchi"}
            </Button>
            <Button type="button" onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Add Item
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={PARCHI_ACCEPT}
              capture="environment"
              className="hidden"
              onChange={(event) => void handleParchiSelected(event)}
            />
          </>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {isLoading ? (
        <SkeletonCards
          count={3}
          columnsClassName="grid gap-4 sm:grid-cols-3"
        />
      ) : (
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Inventory Value"
          value={!metrics ? "—" : formatCurrency(metrics.total_inventory_value)}
          hint="Units in stock × last purchase cost."
          icon={<Package className="h-4 w-4" aria-hidden />}
        />
        <MetricCard
          label="Low Stock Alerts"
          value={!metrics ? "—" : formatQty(metrics.low_stock_count)}
          hint="Items at or below their reorder level."
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
          tone={metrics && metrics.low_stock_count > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Trapped Cash"
          value={!metrics ? "—" : formatCurrency(metrics.dead_stock_value)}
          hint={`${metrics?.dead_stock_count ?? 0} items with no sale in ${dashboard?.dead_stock_days ?? 60}+ days.`}
          icon={<Wallet className="h-4 w-4" aria-hidden />}
          tone={metrics && metrics.dead_stock_value > 0 ? "danger" : "neutral"}
        />
      </div>
      )}

      {inbox.length > 0 ? (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-recoverpe-black">Parchi inbox</p>
              <Badge tone="warning">{inbox.length} to review</Badge>
            </div>
            <ul className="mt-3 divide-y divide-recoverpe-line">
              {inbox.map((capture) => {
                const extraction = normalizeParchiExtraction(capture.raw_ai_json);

                return (
                  <li key={capture.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-recoverpe-black">
                        {extraction.supplier_name || "Unknown supplier"}
                      </p>
                      <p className="type-data-secondary text-xs">
                        {extraction.line_items.length} lines ·{" "}
                        {formatCurrency(extraction.credit_amount)} · scanned{" "}
                        {formatShortDate(capture.created_at)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setReviewCapture(capture)}
                    >
                      Review
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-recoverpe-black">Dead stock liquidator</p>
            <p className="type-data-secondary mt-1 text-xs">
              Turn slow movers back into cash with a WhatsApp flash sale.
            </p>
            {deadItems.length === 0 ? (
              <p className="mt-4 text-sm text-recoverpe-muted">
                {isLoading ? "Loading..." : "No dead stock. Everything moved in the last 60 days."}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-recoverpe-line">
                {deadItems.slice(0, 8).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-recoverpe-black">{item.name}</p>
                      <p className="type-data-secondary text-xs">
                        {formatQty(item.qty_on_hand)} {item.unit} ·{" "}
                        <span className="text-recoverpe-danger-ink">
                          {formatCurrency(item.stock_value)}
                        </span>{" "}
                        · idle {item.days_since_activity}d
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setFlashItem(item)}
                    >
                      Generate WhatsApp Flash Sale
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-recoverpe-black">Supplier khata</p>
            <p className="type-data-secondary mt-1 text-xs">
              Credit owed to suppliers from posted parchis.
            </p>
            {(dashboard?.supplier_payables ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-recoverpe-muted">
                {isLoading ? "Loading..." : "No supplier bills posted yet. Scan a parchi to start."}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-recoverpe-line">
                {(dashboard?.supplier_payables ?? []).slice(0, 8).map((supplier) => (
                  <li
                    key={supplier.supplier_name}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-recoverpe-black">
                        {supplier.supplier_name}
                      </p>
                      <p className="type-data-secondary text-xs">
                        {supplier.voucher_count} bills · last {formatShortDate(supplier.last_bill_date)}
                      </p>
                    </div>
                    <span className={`text-sm ${AMOUNT_CLASS}`}>
                      {formatCurrency(supplier.total_credit)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-recoverpe-muted">Loading stock...</p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Boxes className="h-5 w-5" aria-hidden />}
              title="No stock items yet"
              description="Scan a supplier parchi to add items automatically, or add them by hand."
              action={
                <Button type="button" onClick={() => setIsAddOpen(true)}>
                  Add Item
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Item Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">In Stock</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-[10rem]">
                      <p className="text-sm font-semibold text-recoverpe-black">{item.name}</p>
                      <div className="mt-1 flex gap-1">
                        {item.is_low_stock ? <Badge tone="warning">Low</Badge> : null}
                        {item.is_dead_stock ? <Badge tone="danger">Dead</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-recoverpe-muted">{item.unit}</TableCell>
                    <TableCell
                      className={`text-right ${
                        item.is_low_stock
                          ? "font-mono tabular-nums text-recoverpe-danger-ink"
                          : AMOUNT_CLASS
                      }`}
                    >
                      {formatQty(item.qty_on_hand)}
                    </TableCell>
                    <TableCell className={`text-right ${AMOUNT_CLASS}`}>
                      {formatQty(item.reorder_level)}
                    </TableCell>
                    <TableCell className={`text-right ${AMOUNT_CLASS}`}>
                      {formatCurrency(item.last_cost)}
                    </TableCell>
                    <TableCell className={`text-right ${AMOUNT_CLASS}`}>
                      {formatCurrency(item.selling_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setAdjustItem(item)}
                        >
                          Adjust
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setHistoryItem(item)}
                        >
                          History
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ParchiReviewDrawer
        capture={reviewCapture}
        stockItems={items}
        onClose={() => setReviewCapture(null)}
        onPosted={(result) => {
          setReviewCapture(null);
          setNotice(
            `Posted ${result.voucher.supplier_name}'s bill of ${formatCurrency(
              Number(result.voucher.credit_amount)
            )} to stock and supplier khata.`
          );
          void load();
        }}
        onRejected={(captureId) => {
          setReviewCapture(null);
          setInbox((current) => current.filter((entry) => entry.id !== captureId));
        }}
      />

      <ConversationalCheckoutModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        businessId={businessId}
        stockItems={items}
        onExecuted={() => {
          void load();
        }}
      />

      <AddStockItemModal
        isOpen={isAddOpen}
        businessId={businessId}
        onClose={() => setIsAddOpen(false)}
        onCreated={(item) => {
          setIsAddOpen(false);
          setNotice(`Added ${item.name} to stock.`);
          void load();
        }}
      />

      <AdjustStockModal
        item={adjustItem}
        onClose={() => setAdjustItem(null)}
        onAdjusted={(item) => {
          setAdjustItem(null);
          setNotice(`Updated ${item.name}.`);
          void load();
        }}
      />

      <StockHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />

      <FlashSaleModal
        item={flashItem}
        businessName={activeBusiness?.business_name ?? ""}
        onClose={() => setFlashItem(null)}
      />
    </div>
  );
}
