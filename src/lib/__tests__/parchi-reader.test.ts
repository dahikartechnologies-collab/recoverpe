import { describe, expect, it } from "vitest";
import { normalizeParchiExtraction } from "@/lib/smart-stocks/parchi-reader";

describe("parchi reader extraction", () => {
  it("keeps the structured invoice fields and normalizes the bill date", () => {
    expect(
      normalizeParchiExtraction({
        supplier_name: "  Sharma Traders  ",
        bill_date: "2026-09-30T10:00:00.000Z",
        credit_amount: "1499.5",
        line_items: [
          {
            description: "Cement bag",
            qty: "10",
            rate: 120,
            amount: 1200,
          },
        ],
      })
    ).toEqual({
      supplier_name: "Sharma Traders",
      bill_date: "2026-09-30",
      credit_amount: 1499.5,
      line_items: [
        {
          description: "Cement bag",
          qty: 10,
          rate: 120,
          amount: 1200,
        },
      ],
    });
  });
});
