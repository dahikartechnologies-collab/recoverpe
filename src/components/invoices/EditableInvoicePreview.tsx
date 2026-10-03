"use client";

import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/gst";
import {
  InvoiceLayoutTheme,
  InvoiceLineItem,
  createInvoiceLineItem,
  lineItemAmount,
  sumInvoiceLineItems,
} from "@/lib/invoice-line-items";
import { invoiceThemeCssVars } from "@/lib/invoice-themes";

interface EditableInvoicePreviewProps {
  theme: InvoiceLayoutTheme;
  businessName: string;
  businessAddress?: string | null;
  businessGstin: string | null;
  gstNotRequired?: boolean;
  contactName: string;
  contactPhone: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  onLineItemsChange: (items: InvoiceLineItem[]) => void;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  documentTitle: string;
}

const cellInputClass =
  "h-9 w-full rounded-none border-0 border-b border-transparent bg-transparent px-1 py-1 text-sm text-inherit outline-none hover:border-[#D1D5DB] focus:border-[var(--inv-accent)] focus:ring-0";

export function EditableInvoicePreview({
  theme,
  businessName,
  businessAddress,
  businessGstin,
  gstNotRequired = false,
  contactName,
  contactPhone,
  invoiceNumber,
  invoiceDate,
  dueDate,
  lineItems,
  onLineItemsChange,
  taxableAmount,
  cgst,
  sgst,
  igst,
  grandTotal,
  documentTitle,
}: EditableInvoicePreviewProps) {
  function updateItem(id: string, patch: Partial<InvoiceLineItem>) {
    onLineItemsChange(
      lineItems.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function addRow() {
    onLineItemsChange([
      ...lineItems,
      createInvoiceLineItem({
        description: "Custom item / service",
        quantity: 1,
        unitPrice: 0,
      }),
    ]);
  }

  function removeRow(id: string) {
    if (lineItems.length <= 1) {
      return;
    }

    onLineItemsChange(lineItems.filter((item) => item.id !== id));
  }

  return (
    <div
      data-invoice-theme={theme}
      style={invoiceThemeCssVars(theme)}
      className="mx-auto w-full max-w-[210mm] bg-[var(--inv-page-bg)] text-[var(--inv-text)] shadow-[0_0_0_1px_#E5E7EB]"
    >
      <div
        className="flex items-start justify-between gap-6 px-10 py-8"
        style={{
          background: "var(--inv-header-bg)",
          color: "var(--inv-header-fg)",
        }}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-80">
            RecoverPe
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{businessName}</p>
          {businessAddress ? (
            <p className="mt-2 max-w-sm text-xs leading-5 opacity-80">{businessAddress}</p>
          ) : null}
          {businessGstin ? (
            <p className="mt-2 text-xs opacity-80">GSTIN {businessGstin}</p>
          ) : (
            <p className="mt-2 text-xs opacity-80">
              {gstNotRequired
                ? "GST not registered"
                : "Unregistered dealer · Bill of Supply"}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">
            {documentTitle}
          </p>
          <p className="mt-2 text-lg font-semibold">{invoiceNumber}</p>
          <p className="mt-3 text-xs opacity-80">Date {invoiceDate}</p>
          <p className="text-xs opacity-80">Due {dueDate}</p>
        </div>
      </div>
      <div className="h-1.5" style={{ background: "var(--inv-accent)" }} />

      <div className="grid gap-8 px-10 py-7 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--inv-muted)]">
            Bill to
          </p>
          <p className="mt-2 text-base font-medium">{contactName}</p>
          <p className="mt-1 text-sm text-[var(--inv-muted)]">{contactPhone}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--inv-muted)]">
            Payable
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatCurrency(grandTotal)}
          </p>
        </div>
      </div>

      <div className="px-10 pb-10">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: "var(--inv-table-header)" }}>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide">
                Description
              </th>
              <th className="w-20 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide">
                Qty
              </th>
              <th className="w-28 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide">
                Rate
              </th>
              <th className="w-28 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide">
                Amount
              </th>
              <th className="w-8 px-1 py-3" />
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              <tr
                key={item.id}
                style={{
                  background: index % 2 === 1 ? "var(--inv-row-alt)" : "transparent",
                }}
              >
                <td className="px-2 py-1.5">
                  <input
                    value={item.description}
                    onChange={(event) =>
                      updateItem(item.id, { description: event.target.value })
                    }
                    className={cellInputClass}
                    aria-label="Line item description"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.id, {
                        quantity: Number(event.target.value),
                      })
                    }
                    className={`${cellInputClass} text-right tabular-nums`}
                    aria-label="Quantity"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) =>
                      updateItem(item.id, {
                        unitPrice: Number(event.target.value),
                      })
                    }
                    className={`${cellInputClass} text-right tabular-nums`}
                    aria-label="Unit price"
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(lineItemAmount(item))}
                </td>
                <td className="px-1 py-2">
                  <button
                    type="button"
                    onClick={() => removeRow(item.id)}
                    disabled={lineItems.length <= 1}
                    className="text-sm text-recoverpe-muted disabled:opacity-30"
                    aria-label="Remove line"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            Add line item
          </Button>
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--inv-muted)]">Taxable</dt>
              <dd className="tabular-nums">{formatCurrency(taxableAmount)}</dd>
            </div>
            {cgst > 0 ? (
              <div className="flex justify-between">
                <dt className="text-[var(--inv-muted)]">CGST</dt>
                <dd className="tabular-nums">{formatCurrency(cgst)}</dd>
              </div>
            ) : null}
            {sgst > 0 ? (
              <div className="flex justify-between">
                <dt className="text-[var(--inv-muted)]">SGST</dt>
                <dd className="tabular-nums">{formatCurrency(sgst)}</dd>
              </div>
            ) : null}
            {igst > 0 ? (
              <div className="flex justify-between">
                <dt className="text-[var(--inv-muted)]">IGST</dt>
                <dd className="tabular-nums">{formatCurrency(igst)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <dt>Total due</dt>
              <dd className="tabular-nums">{formatCurrency(grandTotal)}</dd>
            </div>
            <p className="text-[11px] text-[var(--inv-muted)]">
              Live total {formatCurrency(sumInvoiceLineItems(lineItems))}
            </p>
          </dl>
        </div>
      </div>
    </div>
  );
}
