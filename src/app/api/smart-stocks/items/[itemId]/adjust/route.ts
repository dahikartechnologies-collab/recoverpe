import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  authorizeSmartStocksBusiness,
  isUuid,
  mapSmartStocksRpcError,
  smartStocksJsonError,
} from "@/lib/smart-stocks/server";
import { StockItemResponse } from "@/lib/smart-stocks/shared";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { StockItemRow } from "@/types";

export const dynamic = "force-dynamic";

const SCOPE = "stock-adjust";
const STOCK_ITEM_SELECT =
  "id, business_id, name, unit, hsn, gst_rate, reorder_level, qty_on_hand, last_cost, selling_price, created_at, updated_at";

interface RouteContext {
  params: { itemId: string };
}

export const POST = withWorkspaceMutation<RouteContext>(
  async (request, auth, context) => {
    const itemId = context.params.itemId;

    if (!isUuid(itemId)) {
      return smartStocksJsonError(SCOPE, "Invalid stock item.", 400);
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return smartStocksJsonError(SCOPE, "Request body must be valid JSON.", 400);
    }

    const direction = body.direction;
    const qty = Number(body.qty);
    const rate = body.rate === undefined || body.rate === "" ? 0 : Number(body.rate);
    const reorderLevel =
      body.reorder_level === undefined || body.reorder_level === ""
        ? null
        : Number(body.reorder_level);
    const sellingPrice =
      body.selling_price === undefined || body.selling_price === ""
        ? null
        : Number(body.selling_price);
    const hasMovement = Number.isFinite(qty) && qty > 0;

    if (hasMovement && direction !== "in" && direction !== "out") {
      return smartStocksJsonError(SCOPE, "Choose whether stock is added or removed.", 400);
    }

    if (body.qty !== undefined && body.qty !== "" && !hasMovement) {
      return smartStocksJsonError(SCOPE, "Quantity must be above 0.", 400);
    }

    if (!Number.isFinite(rate) || rate < 0) {
      return smartStocksJsonError(SCOPE, "Rate cannot be negative.", 400);
    }

    if (
      (reorderLevel !== null && (!Number.isFinite(reorderLevel) || reorderLevel < 0)) ||
      (sellingPrice !== null && (!Number.isFinite(sellingPrice) || sellingPrice < 0))
    ) {
      return smartStocksJsonError(
        SCOPE,
        "Reorder level and selling price must be zero or more.",
        400
      );
    }

    if (!hasMovement && reorderLevel === null && sellingPrice === null) {
      return smartStocksJsonError(SCOPE, "Nothing to update.", 400);
    }

    const supabase = createAdminSupabaseClient();
    const { data: item, error: itemError } = await supabase
      .from("stock_items")
      .select("id, business_id")
      .eq("id", itemId)
      .maybeSingle();

    if (itemError) {
      return smartStocksJsonError(SCOPE, itemError.message, 500);
    }

    if (!item) {
      return smartStocksJsonError(SCOPE, "Stock item not found.", 404);
    }

    const access = await authorizeSmartStocksBusiness(
      supabase,
      auth,
      item.business_id,
      SCOPE
    );

    if ("error" in access) {
      return access.error;
    }

    if (reorderLevel !== null || sellingPrice !== null) {
      const { error: updateError } = await supabase
        .from("stock_items")
        .update({
          ...(reorderLevel !== null ? { reorder_level: reorderLevel } : {}),
          ...(sellingPrice !== null ? { selling_price: sellingPrice } : {}),
        })
        .eq("id", itemId)
        .eq("business_id", access.business.id);

      if (updateError) {
        return smartStocksJsonError(SCOPE, updateError.message, 500);
      }
    }

    if (hasMovement) {
      const { error: rpcError } = await supabase.rpc("smart_stocks_apply_movements", {
        p_business_id: access.business.id,
        p_direction: direction,
        p_source: "manual",
        p_reference_id: null,
        p_items: [{ item_id: itemId, qty, rate }],
      });

      if (rpcError) {
        const mapped = mapSmartStocksRpcError(rpcError);
        return smartStocksJsonError(SCOPE, mapped.message, mapped.status, {
          code: mapped.code,
        });
      }
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from("stock_items")
      .select(STOCK_ITEM_SELECT)
      .eq("id", itemId)
      .single();

    if (refreshError || !refreshed) {
      return smartStocksJsonError(
        SCOPE,
        refreshError?.message || "Stock updated but could not be reloaded.",
        500
      );
    }

    const response: StockItemResponse = { item: refreshed as StockItemRow };

    return NextResponse.json(response);
  },
  { permission: "edit_ledgers" }
);
