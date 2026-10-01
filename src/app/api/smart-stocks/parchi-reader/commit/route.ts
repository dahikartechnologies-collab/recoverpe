import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  ParchiCommitResponse,
  parseParchiCommitPayload,
} from "@/lib/smart-stocks/shared";
import {
  authorizeSmartStocksBusiness,
  mapSmartStocksRpcError,
  smartStocksJsonError,
} from "@/lib/smart-stocks/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { PurchaseVoucherRow } from "@/types";

export const dynamic = "force-dynamic";

const SCOPE = "parchi-commit";

export const POST = withWorkspaceMutation(async (request, auth) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return smartStocksJsonError(SCOPE, "Request body must be valid JSON.", 400);
  }

  const parsed = parseParchiCommitPayload(body);

  if (!parsed.ok) {
    return smartStocksJsonError(SCOPE, parsed.error, 400);
  }

  const payload = parsed.value;
  const supabase = createAdminSupabaseClient();
  const { data: capture, error: captureError } = await supabase
    .from("document_captures")
    .select("id, business_id, status")
    .eq("id", payload.capture_id)
    .maybeSingle();

  if (captureError) {
    return smartStocksJsonError(SCOPE, captureError.message, 500);
  }

  if (!capture) {
    return smartStocksJsonError(SCOPE, "Parchi not found.", 404);
  }

  const access = await authorizeSmartStocksBusiness(
    supabase,
    auth,
    capture.business_id,
    SCOPE
  );

  if ("error" in access) {
    return access.error;
  }

  if (capture.status !== "pending") {
    return smartStocksJsonError(
      SCOPE,
      "This parchi was already posted or rejected.",
      409,
      { code: "CAPTURE_NOT_PENDING" }
    );
  }

  const { data: result, error: rpcError } = await supabase.rpc(
    "smart_stocks_commit_parchi",
    {
      p_business_id: capture.business_id,
      p_capture_id: payload.capture_id,
      p_supplier_name: payload.supplier_name,
      p_bill_date: payload.bill_date,
      p_credit_amount: payload.credit_amount,
      p_lines: payload.lines,
    }
  );

  if (rpcError) {
    const mapped = mapSmartStocksRpcError(rpcError);
    return smartStocksJsonError(SCOPE, mapped.message, mapped.status, {
      code: mapped.code,
    });
  }

  const outcome = (result ?? {}) as {
    voucher_id?: string;
    items?: Array<{ item_id: string }>;
  };

  if (!outcome.voucher_id) {
    return smartStocksJsonError(SCOPE, "Posting returned no voucher.", 500);
  }

  const { data: voucher, error: voucherError } = await supabase
    .from("purchase_vouchers")
    .select("id, business_id, supplier_name, bill_date, credit_amount, status, created_at, updated_at")
    .eq("id", outcome.voucher_id)
    .single();

  if (voucherError || !voucher) {
    return smartStocksJsonError(
      SCOPE,
      voucherError?.message || "Voucher posted but could not be reloaded.",
      500
    );
  }

  const response: ParchiCommitResponse = {
    success: true,
    voucher: voucher as PurchaseVoucherRow,
    capture_id: payload.capture_id,
    stock_item_ids: Array.from(
      new Set((outcome.items ?? []).map((item) => item.item_id))
    ),
  };

  return NextResponse.json(response, { status: 201 });
}, { permission: "edit_ledgers" });
