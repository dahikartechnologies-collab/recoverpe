import { describe, expect, it } from "vitest";
import {
  buildFlashSaleMessage,
  buildStockDashboard,
  matchStockItemName,
  normalizeIndianMobile,
  normalizeVoiceCommand,
  parseParchiCommitPayload,
  parseVoiceExecutePayload,
  voiceIntentDirection,
} from "@/lib/smart-stocks/shared";
import { StockItemRow } from "@/types";

const CAPTURE_ID = "4f1c2b7e-9a3d-4c1e-8b2a-1d2e3f4a5b6c";
const ITEM_ID = "7a8b9c0d-1e2f-4a3b-9c4d-5e6f7a8b9c0d";

function stockItem(overrides: Partial<StockItemRow>): StockItemRow {
  return {
    id: ITEM_ID,
    business_id: "b1",
    name: "Item",
    unit: "pcs",
    hsn: null,
    qty_on_hand: 0,
    reorder_level: 0,
    last_cost: 0,
    selling_price: 0,
    gst_rate: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseParchiCommitPayload", () => {
  it("accepts a valid payload and derives missing amounts", () => {
    const result = parseParchiCommitPayload({
      capture_id: CAPTURE_ID,
      supplier_name: "  Sharma Traders ",
      bill_date: "2026-09-30",
      credit_amount: "1200.555",
      lines: [{ description: "Cement", qty: 10, rate: 120.5 }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.supplier_name).toBe("Sharma Traders");
      expect(result.value.credit_amount).toBe(1200.56);
      expect(result.value.lines[0]).toMatchObject({
        stock_item_id: null,
        amount: 1205,
        unit: null,
      });
    }
  });

  it("rejects zero quantities and malformed dates", () => {
    const base = {
      capture_id: CAPTURE_ID,
      supplier_name: "A",
      bill_date: "2026-09-30",
      credit_amount: 0,
      lines: [{ description: "Rod", qty: 1, rate: 1 }],
    };

    expect(
      parseParchiCommitPayload({ ...base, lines: [{ description: "Rod", qty: 0, rate: 1 }] }).ok
    ).toBe(false);
    expect(parseParchiCommitPayload({ ...base, bill_date: "30/09/2026" }).ok).toBe(false);
    expect(parseParchiCommitPayload({ ...base, capture_id: "nope" }).ok).toBe(false);
  });
});

describe("matchStockItemName", () => {
  const items = [
    { id: "1", name: "Ambuja Cement 50kg" },
    { id: "2", name: "TMT Bar 12mm" },
  ];

  it("prefers exact and containment matches", () => {
    expect(matchStockItemName("tmt bar 12mm", items)?.item_id).toBe("2");
    expect(matchStockItemName("ambuja cement", items)?.item_id).toBe("1");
  });

  it("returns null for unrelated names", () => {
    expect(matchStockItemName("paint bucket", items)).toBeNull();
  });
});

describe("voice command normalization", () => {
  it("normalizes Indian mobiles", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("9876543210");
    expect(normalizeIndianMobile("09876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("12345")).toBeNull();
  });

  it("drops empty items and defaults unknown intents to sale", () => {
    const command = normalizeVoiceCommand({
      intent: "barter",
      customer_name: "null",
      items: [
        { name: "Cement", qty: 5, unit_price: 0 },
        { name: "", qty: 2 },
      ],
    });

    expect(command.intent).toBe("sale");
    expect(command.customer_name).toBeNull();
    expect(command.items).toEqual([{ name: "Cement", qty: 5, unit_price: null }]);
  });

  it("rejects an invalid customer phone on execute", () => {
    const result = parseVoiceExecutePayload({
      command_id: CAPTURE_ID,
      items: [{ item_id: ITEM_ID, qty: 1, rate: 10 }],
      customer_phone: "123",
    });

    expect(result.ok).toBe(false);
  });

  it("maps purchases inward and everything else outward", () => {
    expect(voiceIntentDirection("purchase")).toBe("in");
    expect(voiceIntentDirection("sale")).toBe("out");
    expect(voiceIntentDirection("adjustment_loss")).toBe("out");
  });
});

describe("buildStockDashboard", () => {
  const now = new Date("2026-10-01T00:00:00.000Z");

  it("computes inventory value, low stock and trapped cash", () => {
    const { metrics, items } = buildStockDashboard(
      [
        stockItem({ id: "fresh", qty_on_hand: 10, last_cost: 50, reorder_level: 2 }),
        stockItem({ id: "low", qty_on_hand: 1, last_cost: 100, reorder_level: 5 }),
        stockItem({ id: "empty", qty_on_hand: 0, last_cost: 100, reorder_level: 0 }),
      ],
      new Map([
        ["fresh", "2026-09-20T00:00:00.000Z"],
        ["low", "2026-07-01T00:00:00.000Z"],
      ]),
      now
    );

    expect(metrics.total_inventory_value).toBe(600);
    expect(metrics.low_stock_count).toBe(2);
    expect(metrics.dead_stock_count).toBe(1);
    expect(metrics.dead_stock_value).toBe(100);
    expect(items.find((item) => item.id === "fresh")?.is_dead_stock).toBe(false);
    expect(items.find((item) => item.id === "empty")?.is_dead_stock).toBe(false);
  });

  it("measures never-sold items from creation", () => {
    const { items } = buildStockDashboard(
      [stockItem({ qty_on_hand: 3, last_cost: 10, created_at: "2026-09-25T00:00:00.000Z" })],
      new Map(),
      now
    );

    expect(items[0].is_dead_stock).toBe(false);
    expect(items[0].days_since_activity).toBe(6);
  });
});

describe("buildFlashSaleMessage", () => {
  it("applies the discount to the selling price", () => {
    const { message, offerPrice, listPrice } = buildFlashSaleMessage({
      businessName: "Gupta Hardware",
      itemName: "Wall Putty",
      unit: "bag",
      qtyOnHand: 12,
      sellingPrice: 400,
      lastCost: 300,
      discountPercent: 25,
    });

    expect(listPrice).toBe(400);
    expect(offerPrice).toBe(300);
    expect(message).toContain("Gupta Hardware");
    expect(message).toContain("25% OFF");
  });
});
