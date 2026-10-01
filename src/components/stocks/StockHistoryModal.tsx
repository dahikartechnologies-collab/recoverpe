"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/gst";
import { fetchStockMovements } from "@/lib/smart-stocks/client";
import { StockItemRow, StockMovementRow, StockMovementSource } from "@/types";

interface StockHistoryModalProps {
  item: StockItemRow | null;
  onClose: () => void;
}

const SOURCE_LABEL: Record<StockMovementSource, string> = {
  parchi: "Parchi",
  voice: "Voice",
  manual: "Manual",
  sale: "Sale",
};

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function StockHistoryModal({ item, onClose }: StockHistoryModalProps) {
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const itemId = item?.id ?? null;

  useEffect(() => {
    if (!itemId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError("");
    setMovements([]);

    fetchStockMovements(itemId)
      .then((response) => {
        if (!cancelled) {
          setMovements(response.movements);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load history.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  if (!item) {
    return null;
  }

  return (
    <Modal isOpen onClose={onClose} title={`${item.name} — history`}>
      <div className="space-y-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {isLoading ? (
          <p className="text-sm text-recoverpe-muted">Loading movements...</p>
        ) : movements.length === 0 && !error ? (
          <p className="text-sm text-recoverpe-muted">No stock movements yet.</p>
        ) : (
          <ul className="divide-y divide-recoverpe-line rounded-lg border border-recoverpe-line">
            {movements.map((movement) => (
              <li key={movement.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={movement.direction === "in" ? "success" : "danger"}>
                      {movement.direction === "in" ? "In" : "Out"}
                    </Badge>
                    <span className="text-xs text-recoverpe-muted">
                      {SOURCE_LABEL[movement.source] ?? movement.source}
                    </span>
                  </div>
                  <p className="type-data-secondary mt-1 text-xs">{formatWhen(movement.created_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm tabular-nums text-recoverpe-black">
                    {movement.direction === "in" ? "+" : "−"}
                    {Number(movement.qty)} {item.unit}
                  </p>
                  <p className="type-data-secondary text-xs">
                    @ {formatCurrency(Number(movement.rate))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
