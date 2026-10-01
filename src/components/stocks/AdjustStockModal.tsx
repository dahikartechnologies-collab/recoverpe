"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { adjustStockItem } from "@/lib/smart-stocks/client";
import { StockItemRow } from "@/types";

interface AdjustStockModalProps {
  item: StockItemRow | null;
  onClose: () => void;
  onAdjusted: (item: StockItemRow) => void;
}

const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-recoverpe-black";

export function AdjustStockModal({ item, onClose, onAdjusted }: AdjustStockModalProps) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!item) {
      return;
    }

    setDirection("in");
    setQty("");
    setRate(Number(item.last_cost) > 0 ? String(item.last_cost) : "");
    setReorderLevel(String(Number(item.reorder_level)));
    setSellingPrice(String(Number(item.selling_price)));
    setError("");
  }, [item]);

  if (!item) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!item) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const { item: updated } = await adjustStockItem(item.id, {
        ...(qty.trim() ? { direction, qty: Number(qty), rate: Number(rate) || 0 } : {}),
        reorder_level: Number(reorderLevel) || 0,
        selling_price: Number(sellingPrice) || 0,
      });
      onAdjusted(updated);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to update stock."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Adjust ${item.name}`} disableClose={isSubmitting}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <p className="text-sm text-recoverpe-muted">
          In stock now:{" "}
          <span className="font-mono tabular-nums text-recoverpe-black">
            {Number(item.qty_on_hand)} {item.unit}
          </span>
        </p>

        <div className="flex gap-2">
          {(["in", "out"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDirection(option)}
              className={`focus-ring flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                direction === option
                  ? "border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
                  : "border-recoverpe-line text-recoverpe-grey-medium hover:text-recoverpe-black"
              }`}
            >
              {option === "in" ? "Add stock" : "Remove stock"}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="adjust-qty" className={LABEL_CLASS}>
              Quantity ({item.unit})
            </label>
            <Input
              id="adjust-qty"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              placeholder="Leave blank to only edit prices"
            />
          </div>
          <div>
            <label htmlFor="adjust-rate" className={LABEL_CLASS}>
              Rate per {item.unit}
            </label>
            <Input
              id="adjust-rate"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="adjust-reorder" className={LABEL_CLASS}>
              Reorder level
            </label>
            <Input
              id="adjust-reorder"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={reorderLevel}
              onChange={(event) => setReorderLevel(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="adjust-selling" className={LABEL_CLASS}>
              Selling price
            </label>
            <Input
              id="adjust-selling"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(event) => setSellingPrice(event.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
