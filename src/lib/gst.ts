export type GstDocumentType = "tax_invoice" | "bill_of_supply";

export interface GstBreakdown {
  documentType: GstDocumentType;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
}

export function calculateGstBreakdown(
  totalAmount: number,
  businessGstin: string | null,
  clientGstin: string | null
): GstBreakdown {
  if (!businessGstin) {
    return {
      documentType: "bill_of_supply",
      taxableAmount: totalAmount,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalAmount,
    };
  }

  const taxableAmount = totalAmount / 1.18;
  const businessStateCode = businessGstin.slice(0, 2);
  const clientStateCode = clientGstin?.slice(0, 2);

  if (clientGstin && businessStateCode === clientStateCode) {
    return {
      documentType: "tax_invoice",
      taxableAmount,
      cgst: taxableAmount * 0.09,
      sgst: taxableAmount * 0.09,
      igst: 0,
      totalAmount,
    };
  }

  return {
    documentType: "tax_invoice",
    taxableAmount,
    cgst: 0,
    sgst: 0,
    igst: taxableAmount * 0.18,
    totalAmount,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
