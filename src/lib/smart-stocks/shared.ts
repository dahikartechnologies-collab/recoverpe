import type {
  DocumentCaptureRow,
  PurchaseVoucherRow,
  StockItemRow,
  StockMovementRow,
} from "@/types";

// Client-safe Smart Stocks logic: types, payload validation, item matching,
// dashboard metrics and flash-sale copy. No server imports belong here.

export const DEAD_STOCK_DAYS = 60;
export const DEFAULT_FLASH_SALE_DISCOUNT_PERCENT = 15;
export const DEFAULT_STOCK_UNIT = "pcs";
export const MAX_COMMIT_LINES = 200;
export const MAX_VOICE_ITEMS = 50;
export const MAX_TRANSCRIPT_LENGTH = 2000;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Parchi extraction
// ---------------------------------------------------------------------------

export interface ParchiLineItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface ParchiExtraction {
  supplier_name: string;
  bill_date: string;
  credit_amount: number;
  line_items: ParchiLineItem[];
}

function asFiniteNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function asIsoDate(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  const isoDay = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoDay) {
    return isoDay[1];
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeParchiExtraction(value: unknown): ParchiExtraction {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawLines = Array.isArray(record.line_items) ? record.line_items : [];

  return {
    supplier_name:
      typeof record.supplier_name === "string" ? record.supplier_name.trim() : "",
    bill_date: asIsoDate(record.bill_date),
    credit_amount: asFiniteNumber(record.credit_amount),
    line_items: rawLines.map((line) => {
      const item =
        line && typeof line === "object" ? (line as Record<string, unknown>) : {};

      return {
        description:
          typeof item.description === "string" ? item.description.trim() : "",
        qty: asFiniteNumber(item.qty),
        rate: asFiniteNumber(item.rate),
        amount: asFiniteNumber(item.amount),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Parchi commit payload
// ---------------------------------------------------------------------------

export interface ParchiCommitLine {
  stock_item_id?: string | null;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  unit?: string | null;
}

export interface ParchiCommitPayload {
  capture_id: string;
  supplier_name: string;
  bill_date: string;
  credit_amount: number;
  lines: ParchiCommitLine[];
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function readNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }

  return Number.NaN;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseParchiCommitPayload(
  body: unknown
): ParseResult<ParchiCommitPayload> {
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;

  if (!record) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (typeof record.capture_id !== "string" || !UUID_PATTERN.test(record.capture_id)) {
    return { ok: false, error: "A valid capture_id is required." };
  }

  const supplierName =
    typeof record.supplier_name === "string" ? record.supplier_name.trim() : "";

  if (!supplierName) {
    return { ok: false, error: "Supplier name is required." };
  }

  const billDate = typeof record.bill_date === "string" ? record.bill_date.trim() : "";

  if (!ISO_DATE_PATTERN.test(billDate) || Number.isNaN(Date.parse(billDate))) {
    return { ok: false, error: "Bill date must be a valid YYYY-MM-DD date." };
  }

  const creditAmount = readNumber(record.credit_amount);

  if (!Number.isFinite(creditAmount) || creditAmount < 0) {
    return { ok: false, error: "Credit amount must be zero or more." };
  }

  if (!Array.isArray(record.lines) || record.lines.length === 0) {
    return { ok: false, error: "Add at least one line item." };
  }

  if (record.lines.length > MAX_COMMIT_LINES) {
    return { ok: false, error: `A parchi can have at most ${MAX_COMMIT_LINES} lines.` };
  }

  const lines: ParchiCommitLine[] = [];

  for (let index = 0; index < record.lines.length; index += 1) {
    const rawLine: unknown = record.lines[index];
    const line =
      rawLine && typeof rawLine === "object"
        ? (rawLine as Record<string, unknown>)
        : {};
    const label = `Line ${index + 1}`;
    const description =
      typeof line.description === "string" ? line.description.trim() : "";
    const qty = readNumber(line.qty);
    const rate = readNumber(line.rate);
    const amountInput = readNumber(line.amount);
    const stockItemId =
      typeof line.stock_item_id === "string" && line.stock_item_id.trim()
        ? line.stock_item_id.trim()
        : null;
    const unit = typeof line.unit === "string" ? line.unit.trim() : "";

    if (!description) {
      return { ok: false, error: `${label} needs a description.` };
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: `${label} (${description}) needs a quantity above 0.` };
    }

    if (!Number.isFinite(rate) || rate < 0) {
      return { ok: false, error: `${label} (${description}) has an invalid rate.` };
    }

    if (stockItemId && !UUID_PATTERN.test(stockItemId)) {
      return { ok: false, error: `${label} (${description}) has an invalid stock item.` };
    }

    const amount = Number.isFinite(amountInput) ? amountInput : qty * rate;

    if (amount < 0) {
      return { ok: false, error: `${label} (${description}) has a negative amount.` };
    }

    lines.push({
      stock_item_id: stockItemId,
      description,
      qty,
      rate,
      amount: roundMoney(amount),
      unit: unit || null,
    });
  }

  return {
    ok: true,
    value: {
      capture_id: record.capture_id,
      supplier_name: supplierName,
      bill_date: billDate,
      credit_amount: roundMoney(creditAmount),
      lines,
    },
  };
}

// ---------------------------------------------------------------------------
// Item name matching
// ---------------------------------------------------------------------------

// Built at runtime: the TS target predates the u flag, but every supported
// runtime has Unicode property escapes. Keeps Devanagari letters intact.
const NON_WORD_CHARACTERS = new RegExp("[^\\p{L}\\p{N}]+", "gu");

export function normalizeItemName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(NON_WORD_CHARACTERS, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function itemTokens(value: string): string[] {
  return normalizeItemName(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

export interface StockItemMatch {
  item_id: string;
  name: string;
  score: number;
}

const MATCH_THRESHOLD = 0.5;

/** Case-insensitive exact, then containment, then token-overlap match. */
export function matchStockItemName(
  spokenName: string,
  items: Pick<StockItemRow, "id" | "name">[]
): StockItemMatch | null {
  const target = normalizeItemName(spokenName);

  if (!target) {
    return null;
  }

  const targetTokens = itemTokens(spokenName);
  let best: StockItemMatch | null = null;

  for (const item of items) {
    const candidate = normalizeItemName(item.name);

    if (!candidate) {
      continue;
    }

    let score = 0;

    if (candidate === target) {
      score = 1;
    } else if (candidate.includes(target) || target.includes(candidate)) {
      const shorter = Math.min(candidate.length, target.length);
      const longer = Math.max(candidate.length, target.length);
      score = 0.6 + 0.3 * (shorter / longer);
    } else if (targetTokens.length > 0) {
      const candidateTokens = new Set(itemTokens(item.name));
      const shared = targetTokens.filter((token) => candidateTokens.has(token)).length;
      const union = new Set([...targetTokens, ...Array.from(candidateTokens)]).size;
      score = union > 0 ? (shared / union) * 0.9 : 0;
    }

    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { item_id: item.id, name: item.name, score: Math.round(score * 100) / 100 };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Voice commands
// ---------------------------------------------------------------------------

export const VOICE_INTENTS = ["sale", "adjustment_loss", "purchase"] as const;
export type VoiceIntent = (typeof VOICE_INTENTS)[number];

export interface VoiceParsedItem {
  name: string;
  qty: number;
  unit_price: number | null;
}

export interface VoiceParsedCommand {
  intent: VoiceIntent;
  customer_name: string | null;
  customer_phone: string | null;
  items: VoiceParsedItem[];
  notes: string;
}

export interface VoiceDraftItem extends VoiceParsedItem {
  match: StockItemMatch | null;
  suggested_rate: number;
  qty_on_hand: number | null;
  unit: string | null;
}

export interface VoiceCommandDraft {
  command_id: string;
  transcript: string;
  parsed: VoiceParsedCommand;
  items: VoiceDraftItem[];
}

export function isVoiceIntent(value: unknown): value is VoiceIntent {
  return typeof value === "string" && (VOICE_INTENTS as readonly string[]).includes(value);
}

/** Returns a 10-digit Indian mobile number, or null when it is not one. */
export function normalizeIndianMobile(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  let digits = value.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed && trimmed.toLowerCase() !== "null" ? trimmed : null;
}

export function normalizeVoiceCommand(value: unknown): VoiceParsedCommand {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawItems = Array.isArray(record.items) ? record.items : [];

  const items: VoiceParsedItem[] = rawItems
    .map((raw) => {
      const item =
        raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const unitPrice = readNumber(item.unit_price);

      return {
        name: typeof item.name === "string" ? item.name.trim() : "",
        qty: asFiniteNumber(item.qty),
        unit_price: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null,
      };
    })
    .filter((item) => item.name && item.qty > 0)
    .slice(0, MAX_VOICE_ITEMS);

  return {
    intent: isVoiceIntent(record.intent) ? record.intent : "sale",
    customer_name: optionalText(record.customer_name),
    customer_phone: normalizeIndianMobile(record.customer_phone),
    items,
    notes: typeof record.notes === "string" ? record.notes.trim() : "",
  };
}

export interface VoiceExecuteItem {
  item_id: string;
  qty: number;
  rate: number;
}

export interface VoiceExecutePayload {
  command_id: string;
  items: VoiceExecuteItem[];
  customer_name: string | null;
  customer_phone: string | null;
}

export function parseVoiceExecutePayload(
  body: unknown
): ParseResult<VoiceExecutePayload> {
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;

  if (!record) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (typeof record.command_id !== "string" || !UUID_PATTERN.test(record.command_id)) {
    return { ok: false, error: "A valid command_id is required." };
  }

  if (!Array.isArray(record.items) || record.items.length === 0) {
    return { ok: false, error: "Select at least one stock item." };
  }

  if (record.items.length > MAX_VOICE_ITEMS) {
    return { ok: false, error: `At most ${MAX_VOICE_ITEMS} items per command.` };
  }

  const items: VoiceExecuteItem[] = [];

  for (let index = 0; index < record.items.length; index += 1) {
    const raw: unknown = record.items[index];
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const qty = readNumber(item.qty);
    const rate = readNumber(item.rate);

    if (typeof item.item_id !== "string" || !UUID_PATTERN.test(item.item_id)) {
      return { ok: false, error: `Item ${index + 1} is not linked to a stock item.` };
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: `Item ${index + 1} needs a quantity above 0.` };
    }

    if (!Number.isFinite(rate) || rate < 0) {
      return { ok: false, error: `Item ${index + 1} has an invalid rate.` };
    }

    items.push({ item_id: item.item_id, qty, rate: roundMoney(rate) });
  }

  const customerName = optionalText(record.customer_name);
  const rawPhone = optionalText(record.customer_phone);
  const customerPhone = rawPhone ? normalizeIndianMobile(rawPhone) : null;

  if (rawPhone && !customerPhone) {
    return { ok: false, error: "Customer phone must be a 10-digit Indian mobile number." };
  }

  return {
    ok: true,
    value: {
      command_id: record.command_id,
      items,
      customer_name: customerName,
      customer_phone: customerPhone,
    },
  };
}

export function voiceIntentDirection(intent: VoiceIntent): "in" | "out" {
  return intent === "purchase" ? "in" : "out";
}

export function sumLineTotal(items: Array<{ qty: number; rate: number }>): number {
  return roundMoney(items.reduce((sum, item) => sum + item.qty * item.rate, 0));
}

// ---------------------------------------------------------------------------
// Dashboard metrics
// ---------------------------------------------------------------------------

export interface StockDashboardItem extends StockItemRow {
  stock_value: number;
  is_low_stock: boolean;
  is_dead_stock: boolean;
  last_outward_at: string | null;
  days_since_activity: number;
}

export interface StockDashboardMetrics {
  total_inventory_value: number;
  low_stock_count: number;
  dead_stock_value: number;
  dead_stock_count: number;
  item_count: number;
}

export interface SupplierPayable {
  supplier_name: string;
  voucher_count: number;
  total_credit: number;
  last_bill_date: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dead stock: units on hand with no outward movement in DEAD_STOCK_DAYS. An
 * item that has never sold is measured from when it was first stocked, so a
 * fresh purchase is not flagged on day one.
 */
export function buildStockDashboard(
  items: StockItemRow[],
  lastOutwardByItem: Map<string, string>,
  now: Date = new Date()
): { items: StockDashboardItem[]; metrics: StockDashboardMetrics } {
  const metrics: StockDashboardMetrics = {
    total_inventory_value: 0,
    low_stock_count: 0,
    dead_stock_value: 0,
    dead_stock_count: 0,
    item_count: items.length,
  };

  const annotated = items.map((item) => {
    const qty = Number(item.qty_on_hand) || 0;
    const cost = Number(item.last_cost) || 0;
    const reorder = Number(item.reorder_level) || 0;
    const stockValue = qty > 0 ? roundMoney(qty * cost) : 0;
    const lastOutwardAt = lastOutwardByItem.get(item.id) ?? null;
    const reference = Date.parse(lastOutwardAt ?? item.created_at);
    const daysSince = Number.isFinite(reference)
      ? Math.max(0, Math.floor((now.getTime() - reference) / DAY_MS))
      : 0;
    const isLow = qty <= reorder;
    const isDead = qty > 0 && daysSince >= DEAD_STOCK_DAYS;

    metrics.total_inventory_value += stockValue;

    if (isLow) {
      metrics.low_stock_count += 1;
    }

    if (isDead) {
      metrics.dead_stock_count += 1;
      metrics.dead_stock_value += stockValue;
    }

    return {
      ...item,
      qty_on_hand: qty,
      last_cost: cost,
      reorder_level: reorder,
      selling_price: Number(item.selling_price) || 0,
      gst_rate: Number(item.gst_rate) || 0,
      stock_value: stockValue,
      is_low_stock: isLow,
      is_dead_stock: isDead,
      last_outward_at: lastOutwardAt,
      days_since_activity: daysSince,
    };
  });

  metrics.total_inventory_value = roundMoney(metrics.total_inventory_value);
  metrics.dead_stock_value = roundMoney(metrics.dead_stock_value);

  return { items: annotated, metrics };
}

// ---------------------------------------------------------------------------
// Dead stock liquidator
// ---------------------------------------------------------------------------

function formatRupees(value: number): string {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;
}

export function buildFlashSaleMessage(input: {
  businessName: string;
  itemName: string;
  unit: string;
  qtyOnHand: number;
  sellingPrice: number;
  lastCost: number;
  discountPercent?: number;
}): { message: string; offerPrice: number; listPrice: number } {
  const discount = Math.min(
    90,
    Math.max(1, input.discountPercent ?? DEFAULT_FLASH_SALE_DISCOUNT_PERCENT)
  );
  const listPrice = input.sellingPrice > 0 ? input.sellingPrice : input.lastCost;
  const offerPrice = roundMoney(listPrice * (1 - discount / 100));
  const shop = input.businessName.trim() || "our shop";
  const qty = new Intl.NumberFormat("en-IN").format(input.qtyOnHand);

  const priceLine =
    listPrice > 0
      ? `Ab sirf ${formatRupees(offerPrice)}/${input.unit} (MRP ${formatRupees(listPrice)}) — ${discount}% OFF!`
      : `Flat ${discount}% OFF on every ${input.unit}!`;

  const message = [
    `*FLASH SALE at ${shop}*`,
    "",
    `*${input.itemName}*`,
    priceLine,
    `Only ${qty} ${input.unit} left. Offer valid till stock lasts.`,
    "",
    "Order karne ke liye isi number par reply karein.",
  ].join("\n");

  return { message, offerPrice, listPrice };
}

export function buildWhatsAppShareLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface ParchiInboxEntry extends DocumentCaptureRow {
  view_url: string;
}

export interface ParchiInboxResponse {
  captures: ParchiInboxEntry[];
}

export interface ParchiUploadResponse {
  success: true;
  document_capture: DocumentCaptureRow;
}

export interface ParchiCommitResponse {
  success: true;
  voucher: PurchaseVoucherRow;
  capture_id: string;
  stock_item_ids: string[];
}

export interface StockDashboardResponse {
  items: StockDashboardItem[];
  metrics: StockDashboardMetrics;
  supplier_payables: SupplierPayable[];
  pending_parchi_count: number;
  dead_stock_days: number;
}

export interface StockItemResponse {
  item: StockItemRow;
}

export interface StockMovementsResponse {
  item: StockItemRow;
  movements: StockMovementRow[];
}

export interface VoiceCommandParseResponse {
  draft: VoiceCommandDraft;
}

export interface VoiceCommandExecuteResponse {
  success: true;
  command_id: string;
  intent: VoiceIntent;
  total_amount: number;
  ledger_id: string | null;
  whatsapp_sent: boolean;
  whatsapp_status: VoiceReceiptStatus;
  items: Array<{ item_id: string; name: string; qty: number; rate: number }>;
}

/** `disabled` means the merchant switched off Smart Stocks Receipts. */
export type VoiceReceiptStatus = "sent" | "failed" | "disabled" | "not_applicable";
