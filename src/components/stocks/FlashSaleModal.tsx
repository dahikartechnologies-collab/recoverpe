"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/gst";
import {
  buildFlashSaleMessage,
  buildWhatsAppShareLink,
  DEFAULT_FLASH_SALE_DISCOUNT_PERCENT,
  StockDashboardItem,
} from "@/lib/smart-stocks/shared";

interface FlashSaleModalProps {
  item: StockDashboardItem | null;
  businessName: string;
  onClose: () => void;
}

export function FlashSaleModal({ item, businessName, onClose }: FlashSaleModalProps) {
  const [discount, setDiscount] = useState(String(DEFAULT_FLASH_SALE_DISCOUNT_PERCENT));
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item) {
      return;
    }

    setCopied(false);
    setMessage(
      buildFlashSaleMessage({
        businessName,
        itemName: item.name,
        unit: item.unit,
        qtyOnHand: item.qty_on_hand,
        sellingPrice: item.selling_price,
        lastCost: item.last_cost,
        discountPercent: Number(discount) || DEFAULT_FLASH_SALE_DISCOUNT_PERCENT,
      }).message
    );
  }, [item, businessName, discount]);

  if (!item) {
    return null;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="WhatsApp flash sale">
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-muted">
          {item.name} has {item.qty_on_hand} {item.unit} worth{" "}
          <span className="font-mono tabular-nums text-recoverpe-black">
            {formatCurrency(item.stock_value)}
          </span>{" "}
          with no sale in {item.days_since_activity} days.
        </p>
        <div className="w-32">
          <label htmlFor="flash-discount" className="mb-1.5 block text-sm font-medium text-recoverpe-black">
            Discount %
          </label>
          <Input
            id="flash-discount"
            type="number"
            inputMode="numeric"
            min="1"
            max="90"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="flash-message" className="mb-1.5 block text-sm font-medium text-recoverpe-black">
            Message
          </label>
          <textarea
            id="flash-message"
            rows={8}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="focus-ring w-full rounded-md border border-recoverpe-line bg-recoverpe-white px-3 py-2.5 text-sm text-recoverpe-black focus:border-recoverpe-black"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
            {copied ? "Copied" : "Copy text"}
          </Button>
          <a
            href={buildWhatsAppShareLink(message)}
            target="_blank"
            rel="noreferrer"
            className="focus-ring rp-press inline-flex h-10 items-center justify-center rounded-md border border-recoverpe-black bg-recoverpe-black px-4 text-sm font-medium text-recoverpe-white hover:bg-recoverpe-grey-medium"
          >
            Share on WhatsApp
          </a>
        </div>
      </div>
    </Modal>
  );
}
