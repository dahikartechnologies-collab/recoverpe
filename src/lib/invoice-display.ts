export interface DisplayInvoiceInput {
  id: string;
  invoice_number?: string | null;
}

export function formatDisplayInvoice(ledger: DisplayInvoiceInput): string {
  const trimmed = ledger.invoice_number?.trim();

  if (trimmed) {
    return trimmed;
  }

  return `INV-${ledger.id.slice(0, 8).toUpperCase()}`;
}
