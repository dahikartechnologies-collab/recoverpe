"use client";

import { FormEvent, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { createStockItem } from "@/lib/smart-stocks/client";
import { DEFAULT_STOCK_UNIT } from "@/lib/smart-stocks/shared";
import { StockItemRow } from "@/types";

interface AddStockItemModalProps {
  isOpen: boolean;
  businessId: string;
  onClose: () => void;
  onCreated: (item: StockItemRow) => void;
}

const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-recoverpe-black";

function numberOrUndefined(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

export function AddStockItemModal({
  isOpen,
  businessId,
  onClose,
  onCreated,
}: AddStockItemModalProps) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState(DEFAULT_STOCK_UNIT);
  const [openingQty, setOpeningQty] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setName("");
    setUnit(DEFAULT_STOCK_UNIT);
    setOpeningQty("");
    setReorderLevel("");
    setCostPrice("");
    setSellingPrice("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const { item } = await createStockItem({
        business_id: businessId,
        name,
        unit,
        qty_on_hand: numberOrUndefined(openingQty),
        reorder_level: numberOrUndefined(reorderLevel),
        last_cost: numberOrUndefined(costPrice),
        selling_price: numberOrUndefined(sellingPrice),
      });
      reset();
      onCreated(item);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add the item.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add stock item"
      disableClose={isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="stock-name" className={LABEL_CLASS}>
              Item name
            </label>
            <Input
              id="stock-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Cement 50kg bag"
              required
            />
          </div>
          <div>
            <label htmlFor="stock-unit" className={LABEL_CLASS}>
              Unit
            </label>
            <Input
              id="stock-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="pcs, kg, bag"
              required
            />
          </div>
          <div>
            <label htmlFor="stock-opening" className={LABEL_CLASS}>
              Opening stock
            </label>
            <Input
              id="stock-opening"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={openingQty}
              onChange={(event) => setOpeningQty(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="stock-reorder" className={LABEL_CLASS}>
              Reorder level
            </label>
            <Input
              id="stock-reorder"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={reorderLevel}
              onChange={(event) => setReorderLevel(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="stock-cost" className={LABEL_CLASS}>
              Cost price
            </label>
            <Input
              id="stock-cost"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={costPrice}
              onChange={(event) => setCostPrice(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="stock-selling" className={LABEL_CLASS}>
              Selling price
            </label>
            <Input
              id="stock-selling"
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add item"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
