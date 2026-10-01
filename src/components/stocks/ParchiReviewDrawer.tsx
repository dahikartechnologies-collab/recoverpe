"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/gst";
import { commitParchi, rejectParchi } from "@/lib/smart-stocks/client";
import {
  DEFAULT_STOCK_UNIT,
  matchStockItemName,
  normalizeParchiExtraction,
  ParchiCommitResponse,
  ParchiInboxEntry,
} from "@/lib/smart-stocks/shared";
import { getTodayDateStringInIst } from "@/lib/timezone";
import { StockItemRow } from "@/types";

type StockOption = Pick<StockItemRow, "id" | "name" | "unit">;

interface ParchiReviewDrawerProps {
  capture: ParchiInboxEntry | null;
  stockItems: StockOption[];
  onClose: () => void;
  onPosted: (result: ParchiCommitResponse) => void;
  onRejected: (captureId: string) => void;
}

interface DraftLine {
  key: number;
  stockItemId: string;
  description: string;
  unit: string;
  qty: string;
  rate: string;
  amount: string;
  amountEdited: boolean;
}

const SELECT_CLASS =
  "focus-ring w-full rounded-md border border-recoverpe-line bg-recoverpe-white px-2 py-2 text-sm text-recoverpe-black focus:border-recoverpe-black";
const LABEL_CLASS = "mb-1.5 block text-xs font-medium text-recoverpe-black";

let lineKeySeed = 0;

function nextLineKey(): number {
  lineKeySeed += 1;
  return lineKeySeed;
}

function toInputNumber(value: number): string {
  return Number.isFinite(value) && value !== 0 ? String(value) : "";
}

function computeAmount(qty: string, rate: string): string {
  const total = Number(qty) * Number(rate);
  return Number.isFinite(total) && total > 0 ? String(Math.round(total * 100) / 100) : "";
}

function buildInitialLines(capture: ParchiInboxEntry, stockItems: StockOption[]): DraftLine[] {
  const extraction = normalizeParchiExtraction(capture.raw_ai_json);
  const lines = extraction.line_items.map((line) => {
    const match = matchStockItemName(line.description, stockItems);
    const matched = match ? stockItems.find((item) => item.id === match.item_id) : null;

    return {
      key: nextLineKey(),
      stockItemId: match?.item_id ?? "",
      description: line.description,
      unit: matched?.unit ?? DEFAULT_STOCK_UNIT,
      qty: toInputNumber(line.qty),
      rate: toInputNumber(line.rate),
      amount: toInputNumber(line.amount),
      amountEdited: line.amount > 0 && Math.abs(line.amount - line.qty * line.rate) > 0.01,
    };
  });

  return lines.length > 0 ? lines : [emptyLine()];
}

function emptyLine(): DraftLine {
  return {
    key: nextLineKey(),
    stockItemId: "",
    description: "",
    unit: DEFAULT_STOCK_UNIT,
    qty: "",
    rate: "",
    amount: "",
    amountEdited: false,
  };
}

export function ParchiReviewDrawer({
  capture,
  stockItems,
  onClose,
  onPosted,
  onRejected,
}: ParchiReviewDrawerProps) {
  const [supplierName, setSupplierName] = useState("");
  const [billDate, setBillDate] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const captureId = capture?.id ?? null;

  // Re-seed the form only when a different parchi is opened, so a dashboard
  // refresh of stockItems never wipes the merchant's edits.
  useEffect(() => {
    if (!capture) {
      return;
    }

    const extraction = normalizeParchiExtraction(capture.raw_ai_json);
    setSupplierName(extraction.supplier_name);
    setBillDate(
      /^\d{4}-\d{2}-\d{2}$/.test(extraction.bill_date)
        ? extraction.bill_date
        : getTodayDateStringInIst()
    );
    setCreditAmount(toInputNumber(extraction.credit_amount));
    setLines(buildInitialLines(capture, stockItems));
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on capture id by design
  }, [captureId]);

  useEffect(() => {
    if (!capture) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [capture, isSubmitting, onClose]);

  const linesTotal = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [lines]
  );
  const creditValue = Number(creditAmount) || 0;
  const totalsMismatch = creditValue > 0 && Math.abs(linesTotal - creditValue) > 1;

  if (!capture) {
    return null;
  }

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) {
          return line;
        }

        const next = { ...line, ...patch };

        if (("qty" in patch || "rate" in patch) && !next.amountEdited) {
          next.amount = computeAmount(next.qty, next.rate);
        }

        return next;
      })
    );
  }

  function selectStockItem(key: number, stockItemId: string) {
    const item = stockItems.find((option) => option.id === stockItemId);
    updateLine(key, {
      stockItemId,
      ...(item ? { unit: item.unit } : {}),
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!capture) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const result = await commitParchi({
        capture_id: capture.id,
        supplier_name: supplierName,
        bill_date: billDate,
        credit_amount: Number(creditAmount) || 0,
        lines: lines.map((line) => ({
          stock_item_id: line.stockItemId || null,
          description: line.description,
          unit: line.unit,
          qty: Number(line.qty),
          rate: Number(line.rate) || 0,
          amount: Number(line.amount) || 0,
        })),
      });
      onPosted(result);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to post the parchi."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    if (!capture) {
      return;
    }

    setError("");
    setIsRejecting(true);

    try {
      await rejectParchi(capture.id);
      onRejected(capture.id);
    } catch (rejectError) {
      setError(
        rejectError instanceof Error ? rejectError.message : "Failed to discard the parchi."
      );
    } finally {
      setIsRejecting(false);
    }
  }

  const busy = isSubmitting || isRejecting;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close parchi review"
        className="absolute inset-0 bg-recoverpe-black/40"
        onClick={busy ? undefined : onClose}
        disabled={busy}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="parchi-review-title"
        className="relative z-10 flex h-full w-full max-w-6xl flex-col border-l border-recoverpe-line bg-recoverpe-white"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-recoverpe-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="parchi-review-title" className="text-lg font-semibold text-recoverpe-black">
              Review parchi
            </h2>
            <p className="type-data-secondary mt-0.5 text-xs">
              AI read this bill. Check every line before posting it to stock and the supplier khata.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="neutral">
              {Math.round(Number(capture.confidence_score) * 100)}% confidence
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Close"
              onClick={onClose}
              disabled={busy}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(12rem,40%)_1fr] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-1">
          <div className="min-h-0 overflow-auto border-b border-recoverpe-line bg-recoverpe-fill p-4 lg:border-b-0 lg:border-r">
            <a href={capture.view_url} target="_blank" rel="noreferrer" className="focus-ring block">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not a static asset */}
              <img
                src={capture.view_url}
                alt="Uploaded supplier parchi"
                className="mx-auto h-auto max-w-full rounded-md border border-recoverpe-line bg-recoverpe-white"
              />
            </a>
            <p className="type-data-secondary mt-2 text-center text-xs">
              Tap the image to open it full size.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {error ? <Alert tone="danger">{error}</Alert> : null}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <label htmlFor="parchi-supplier" className={LABEL_CLASS}>
                    Supplier
                  </label>
                  <Input
                    id="parchi-supplier"
                    value={supplierName}
                    onChange={(event) => setSupplierName(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="parchi-date" className={LABEL_CLASS}>
                    Bill date
                  </label>
                  <Input
                    id="parchi-date"
                    type="date"
                    value={billDate}
                    onChange={(event) => setBillDate(event.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="parchi-credit" className={LABEL_CLASS}>
                    Amount payable to supplier (credit)
                  </label>
                  <Input
                    id="parchi-credit"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={creditAmount}
                    onChange={(event) => setCreditAmount(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-recoverpe-black">Line items</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setLines((current) => [...current, emptyLine()])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Add line
                  </Button>
                </div>

                <div className="space-y-3">
                  {lines.map((line, index) => (
                    <div
                      key={line.key}
                      className="rounded-lg border border-recoverpe-line p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <label className="sr-only" htmlFor={`line-desc-${line.key}`}>
                            Line {index + 1} description
                          </label>
                          <Input
                            id={`line-desc-${line.key}`}
                            placeholder="Item description"
                            value={line.description}
                            onChange={(event) =>
                              updateLine(line.key, { description: event.target.value })
                            }
                            required
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove line ${index + 1}`}
                          onClick={() =>
                            setLines((current) =>
                              current.length > 1
                                ? current.filter((entry) => entry.key !== line.key)
                                : current
                            )
                          }
                          disabled={lines.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
                        <div className="col-span-2 sm:col-span-2">
                          <label className={LABEL_CLASS} htmlFor={`line-item-${line.key}`}>
                            Stock item
                          </label>
                          <select
                            id={`line-item-${line.key}`}
                            className={SELECT_CLASS}
                            value={line.stockItemId}
                            onChange={(event) => selectStockItem(line.key, event.target.value)}
                          >
                            <option value="">+ New item from description</option>
                            {stockItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.unit})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={LABEL_CLASS} htmlFor={`line-unit-${line.key}`}>
                            Unit
                          </label>
                          <Input
                            id={`line-unit-${line.key}`}
                            value={line.unit}
                            onChange={(event) => updateLine(line.key, { unit: event.target.value })}
                            disabled={Boolean(line.stockItemId)}
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS} htmlFor={`line-qty-${line.key}`}>
                            Qty
                          </label>
                          <Input
                            id={`line-qty-${line.key}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={line.qty}
                            onChange={(event) => updateLine(line.key, { qty: event.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS} htmlFor={`line-rate-${line.key}`}>
                            Rate
                          </label>
                          <Input
                            id={`line-rate-${line.key}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={line.rate}
                            onChange={(event) => updateLine(line.key, { rate: event.target.value })}
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS} htmlFor={`line-amount-${line.key}`}>
                            Amount
                          </label>
                          <Input
                            id={`line-amount-${line.key}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={line.amount}
                            onChange={(event) =>
                              updateLine(line.key, {
                                amount: event.target.value,
                                amountEdited: event.target.value !== "",
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="shrink-0 space-y-3 border-t border-recoverpe-line px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-recoverpe-muted">Lines total</span>
                <span className="font-mono tabular-nums text-recoverpe-black">
                  {formatCurrency(linesTotal)}
                </span>
              </div>
              {totalsMismatch ? (
                <p className="text-xs text-recoverpe-warning-ink">
                  Lines add up to {formatCurrency(linesTotal)} but the bill credit is{" "}
                  {formatCurrency(creditValue)}. That is fine if the bill includes GST, freight
                  or discounts; otherwise fix the lines.
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => void handleReject()}
                  disabled={busy}
                >
                  {isRejecting ? "Discarding..." : "Discard parchi"}
                </Button>
                <Button type="submit" disabled={busy}>
                  {isSubmitting ? "Posting..." : "Confirm & Post to Ledger"}
                </Button>
              </div>
            </footer>
          </form>
        </div>
      </aside>
    </div>
  );
}
