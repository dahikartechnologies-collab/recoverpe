import { describe, expect, it } from "vitest";
import {
  createInvoiceLineItem,
  defaultInvoiceLineItems,
  lineItemAmount,
  sumInvoiceLineItems,
} from "@/lib/invoice-line-items";

describe("invoice line items", () => {
  it("defaults a single outstanding row from the ledger total", () => {
    const items = defaultInvoiceLineItems(1500);
    expect(items).toHaveLength(1);
    expect(sumInvoiceLineItems(items)).toBe(1500);
  });

  it("recalculates the running total when quantities and rates change", () => {
    const items = [
      createInvoiceLineItem({ id: "a", description: "Bags", quantity: 2, unitPrice: 250 }),
      createInvoiceLineItem({ id: "b", description: "Freight", quantity: 1, unitPrice: 80.5 }),
    ];

    expect(lineItemAmount(items[0])).toBe(500);
    expect(sumInvoiceLineItems(items)).toBe(580.5);
  });
});
