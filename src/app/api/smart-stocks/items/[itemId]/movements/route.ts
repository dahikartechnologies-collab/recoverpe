import { NextResponse } from "next/server";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import {
  authorizeSmartStocksBusiness,
  isUuid,
  smartStocksJsonError,
} from "@/lib/smart-stocks/server";
import { StockMovementsResponse } from "@/lib/smart-stocks/shared";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { StockItemRow, StockMovementRow } from "@/types";

export const dynamic = "force-dynamic";

const SCOPE = "stock-history";
const HISTORY_LIMIT = 100;

export async function GET(
  request: Request,
  context: { params: { itemId: string } }
) {
  const itemId = context.params.itemId;

  if (!isUuid(itemId)) {
    return smartStocksJsonError(SCOPE, "Invalid stock item.", 400);
  }

  const authResult = await resolveWorkspaceAuth(request);

  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = createAdminSupabaseClient();
  const { data: item, error: itemError } = await supabase
    .from("stock_items")
    .select(
      "id, business_id, name, unit, hsn, gst_rate, reorder_level, qty_on_hand, last_cost, selling_price, created_at, updated_at"
    )
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
    authResult,
    item.business_id,
    SCOPE
  );

  if ("error" in access) {
    return access.error;
  }

  const { data: movements, error } = await supabase
    .from("stock_movements")
    .select(
      "id, business_id, item_id, direction, qty, rate, source, reference_id, created_at, updated_at"
    )
    .eq("business_id", access.business.id)
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    return smartStocksJsonError(SCOPE, error.message, 500);
  }

  const response: StockMovementsResponse = {
    item: item as StockItemRow,
    movements: (movements ?? []) as StockMovementRow[],
  };

  return NextResponse.json(response);
}
