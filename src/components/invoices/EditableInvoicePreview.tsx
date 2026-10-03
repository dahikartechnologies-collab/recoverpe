"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/gst";
import {
  INVOICE_THEME_OPTIONS,
  InvoiceLayoutTheme,
  InvoiceLineItem,
  createInvoiceLineItem,
  lineItemAmount,
  sumInvoiceLineItems,
} from "@/lib/invoice-line-items";
import { invoiceThemeCssVars } from "@/lib/invoice-themes";

interface EditableInvoicePreviewProps {
  theme: InvoiceLayoutTheme;
  onThemeChange: (theme: InvoiceLayoutTheme) => void;
  businessName: string;
  businessGstin: string | null;
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

export function EditableInvoicePreview({
  theme,
  onThemeChange,
  businessName,
  businessGstin,
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
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-muted">
          Invoice layout
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {INVOICE_THEME_OPTIONS.map((option) => {
            const selected = option.id === theme;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onThemeChange(option.id)}
                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? "border-recoverpe-black bg-recoverpe-fill"
                    : "border-recoverpe-line bg-recoverpe-white hover:bg-recoverpe-fill"
                }`}
              >
                <span className="block font-medium text-recoverpe-black">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-recoverpe-muted">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        data-invoice-theme={theme}
        style={invoiceThemeCssVars(theme)}
        className="overflow-hidden rounded-xl border border-recoverpe-line bg-[var(--inv-page-bg)] text-[var(--inv-text)]"
      >
        <div
          className="flex items-start justify-between gap-4 px-5 py-4"
          style={{
            background: "var(--inv-header-bg)",
            color: "var(--inv-header-fg)",
          }}
        >
          <div>
            <p className="text-lg font-semibold tracking-tight">{businessName}</p>
            {businessGstin ? (
              <p className="mt-1 text-xs opacity-80">GSTIN {businessGstin}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">
              {documentTitle}
            </p>
            <p className="mt-1 text-sm">{invoiceNumber}</p>
          </div>
        </div>
        <div className="h-1.5" style={{ background: "var(--inv-accent)" }} />

        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--inv-muted)]">
              Bill to
            </p>
            <p className="mt-1 text-sm font-medium">{contactName}</p>
            <p className="text-sm text-[var(--inv-muted)]">{contactPhone}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--inv-muted)]">
              Dates
            </p>
            <p className="mt-1 text-sm">Invoice {invoiceDate}</p>
            <p className="text-sm">Due {dueDate}</p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr style={{ background: "var(--inv-table-header)" }}>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                    Description
                  </th>
                  <th className="w-20 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                    Qty
                  </th>
                  <th className="w-28 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                    Rate
                  </th>
                  <th className="w-28 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr
                    key={item.id}
                    style={{
                      background:
                        index % 2 === 1 ? "var(--inv-row-alt)" : "transparent",
                    }}
                  >
                    <td className="px-1 py-1">
                      <Input
                        value={item.description}
                        onChange={(event) =>
                          updateItem(item.id, { description: event.target.value })
                        }
                        className="h-9 border-transparent bg-transparent px-2 py-1 text-sm hover:border-recoverpe-line"
                        aria-label="Line item description"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, {
                            quantity: Number(event.target.value),
                          })
                        }
                        className="h-9 border-transparent bg-transparent px-2 py-1 text-right text-sm hover:border-recoverpe-line"
                        aria-label="Quantity"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(item.id, {
                            unitPrice: Number(event.target.value),
                          })
                        }
                        className="h-9 border-transparent bg-transparent px-2 py-1 text-right text-sm hover:border-recoverpe-line"
                        aria-label="Unit price"
                      />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatCurrency(lineItemAmount(item))}
                    </td>
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => removeRow(item.id)}
                        disabled={lineItems.length <= 1}
                        className="text-xs text-recoverpe-muted disabled:opacity-30"
                        aria-label="Remove line"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <Button type="button" variant="secondary" size="sm" onClick={addRow}>
              Add line item
            </Button>
            <dl className="w-full max-w-xs space-y-1 text-sm">
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
              <div className="flex justify-between border-t border-[var(--inv-accent)] pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(grandTotal)}</dd>
              </div>
              <p className="text-[11px] text-[var(--inv-muted)]">
                Running total {formatCurrency(sumInvoiceLineItems(lineItems))}
              </p>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
