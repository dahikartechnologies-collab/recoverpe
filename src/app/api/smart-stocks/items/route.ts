import { NextResponse } from "next/server";
import { resolveWorkspaceAuth, withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  authorizeSmartStocksBusiness,
  mapSmartStocksRpcError,
  smartStocksJsonError,
} from "@/lib/smart-stocks/server";
import {
  buildStockDashboard,
  DEAD_STOCK_DAYS,
  DEFAULT_STOCK_UNIT,
  StockDashboardResponse,
  StockItemResponse,
  SupplierPayable,
} from "@/lib/smart-stocks/shared";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { StockItemRow } from "@/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_ITEMS = 10000;
const STOCK_ITEM_SELECT =
  "id, business_id, name, unit, hsn, gst_rate, reorder_level, qty_on_hand, last_cost, selling_price, created_at, updated_at";

type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string; code?: string } | null;
}>;

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PageResult<T>
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; from < MAX_ITEMS; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);

    if (error) {
      throw Object.assign(new Error(error.message), { code: error.code });
    }

    rows.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

export async function GET(request: Request) {
  const authResult = await resolveWorkspaceAuth(request);

  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = createAdminSupabaseClient();
  const businessId = new URL(request.url).searchParams.get("business_id");
  const access = await authorizeSmartStocksBusiness(
    supabase,
    authResult,
    businessId,
    "stock-dashboard"
  );

  if ("error" in access) {
    return access.error;
  }

  const id = access.business.id;

  try {
    const [items, lastOutward, payables, pending] = await Promise.all([
      fetchAllPages<StockItemRow>((from, to) =>
        supabase
          .from("stock_items")
          .select(STOCK_ITEM_SELECT)
          .eq("business_id", id)
          .order("name", { ascending: true })
          .range(from, to)
      ),
      fetchAllPages<{ item_id: string; last_outward_at: string }>((from, to) =>
        supabase.rpc("smart_stocks_last_outward", { p_business_id: id }).range(from, to)
      ),
      supabase.rpc("smart_stocks_supplier_payables", { p_business_id: id }).limit(100),
      supabase
        .from("document_captures")
        .select("id", { count: "exact", head: true })
        .eq("business_id", id)
        .eq("status", "pending"),
    ]);

    if (payables.error) {
      throw Object.assign(new Error(payables.error.message), {
        code: payables.error.code,
      });
    }

    const lastOutwardByItem = new Map(
      lastOutward.map((row) => [row.item_id, row.last_outward_at])
    );
    const dashboard = buildStockDashboard(items, lastOutwardByItem);
    const supplierPayables: SupplierPayable[] = (
      (payables.data ?? []) as Array<Record<string, unknown>>
    ).map((row) => ({
      supplier_name: String(row.supplier_name ?? ""),
      voucher_count: Number(row.voucher_count ?? 0),
      total_credit: Number(row.total_credit ?? 0),
      last_bill_date: String(row.last_bill_date ?? ""),
    }));

    const response: StockDashboardResponse = {
      items: dashboard.items,
      metrics: dashboard.metrics,
      supplier_payables: supplierPayables,
      pending_parchi_count: pending.count ?? 0,
      dead_stock_days: DEAD_STOCK_DAYS,
    };

    return NextResponse.json(response);
  } catch (error) {
    const mapped = mapSmartStocksRpcError(
      error as { message?: string; code?: string }
    );

    return smartStocksJsonError("stock-dashboard", mapped.message, mapped.status, {
      code: mapped.code,
    });
  }
}

function readNonNegative(value: unknown, fallback = 0): number | null {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export const POST = withWorkspaceMutation(async (request, auth) => {
  const scope = "stock-item-create";
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return smartStocksJsonError(scope, "Request body must be valid JSON.", 400);
  }

  const supabase = createAdminSupabaseClient();
  const access = await authorizeSmartStocksBusiness(
    supabase,
    auth,
    body.business_id,
    scope
  );

  if ("error" in access) {
    return access.error;
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const unit =
    (typeof body.unit === "string" ? body.unit.trim() : "") || DEFAULT_STOCK_UNIT;
  const hsn = typeof body.hsn === "string" && body.hsn.trim() ? body.hsn.trim() : null;
  const qtyOnHand = readNonNegative(body.qty_on_hand);
  const reorderLevel = readNonNegative(body.reorder_level);
  const lastCost = readNonNegative(body.last_cost);
  const sellingPrice = readNonNegative(body.selling_price);
  const gstRate = readNonNegative(body.gst_rate);

  if (!name) {
    return smartStocksJsonError(scope, "Item name is required.", 400);
  }

  if (name.length > 200 || unit.length > 30) {
    return smartStocksJsonError(scope, "Item name or unit is too long.", 400);
  }

  if (
    qtyOnHand === null ||
    reorderLevel === null ||
    lastCost === null ||
    sellingPrice === null ||
    gstRate === null ||
    gstRate > 28
  ) {
    return smartStocksJsonError(
      scope,
      "Quantity, reorder level, prices and GST must be valid numbers (GST up to 28%).",
      400
    );
  }

  const { data: item, error } = await supabase
    .from("stock_items")
    .insert({
      business_id: access.business.id,
      name,
      unit,
      hsn,
      gst_rate: gstRate,
      reorder_level: reorderLevel,
      qty_on_hand: 0,
      last_cost: lastCost,
      selling_price: sellingPrice,
    })
    .select(STOCK_ITEM_SELECT)
    .single();

  if (error || !item) {
    if (error?.code === "23505") {
      return smartStocksJsonError(scope, `"${name}" is already in your stock list.`, 409);
    }

    return smartStocksJsonError(scope, error?.message || "Failed to add the item.", 500);
  }

  if (qtyOnHand > 0) {
    const { error: openingError } = await supabase.rpc("smart_stocks_apply_movements", {
      p_business_id: access.business.id,
      p_direction: "in",
      p_source: "manual",
      p_reference_id: null,
      p_items: [{ item_id: item.id, qty: qtyOnHand, rate: lastCost }],
    });

    if (openingError) {
      await supabase.from("stock_items").delete().eq("id", item.id);
      const mapped = mapSmartStocksRpcError(openingError);

      return smartStocksJsonError(scope, mapped.message, mapped.status, {
        code: mapped.code,
      });
    }
  }

  const { data: refreshed } = await supabase
    .from("stock_items")
    .select(STOCK_ITEM_SELECT)
    .eq("id", item.id)
    .single();

  const response: StockItemResponse = {
    item: (refreshed ?? item) as StockItemRow,
  };

  return NextResponse.json(response, { status: 201 });
}, { permission: "edit_ledgers" });
