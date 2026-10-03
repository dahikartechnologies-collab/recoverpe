export type InvoiceLayoutTheme = "minimalist" | "corporate" | "modern";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export function createInvoiceLineItem(
  overrides: Partial<InvoiceLineItem> = {}
): InvoiceLineItem {
  return {
    id:
      overrides.id ??
      `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    description: overrides.description ?? "",
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice ?? 0,
  };
}

export function lineItemAmount(item: InvoiceLineItem): number {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function sumInvoiceLineItems(items: InvoiceLineItem[]): number {
  return Math.round(items.reduce((total, item) => total + lineItemAmount(item), 0) * 100) / 100;
}

export function defaultInvoiceLineItems(totalAmount: number): InvoiceLineItem[] {
  return [
    createInvoiceLineItem({
      id: "line-default",
      description: "Outstanding amount due against supplied goods / services",
      quantity: 1,
      unitPrice: Number.isFinite(totalAmount) ? totalAmount : 0,
    }),
  ];
}

export const INVOICE_THEME_OPTIONS: Array<{
  id: InvoiceLayoutTheme;
  label: string;
  hint: string;
}> = [
  {
    id: "minimalist",
    label: "Minimalist (B&W)",
    hint: "High-contrast grayscale for laser printers",
  },
  {
    id: "corporate",
    label: "Corporate",
    hint: "Navy headers and teal accents",
  },
  {
    id: "modern",
    label: "Modern",
    hint: "Borderless rows with a softer layout",
  },
];
