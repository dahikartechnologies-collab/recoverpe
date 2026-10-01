import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  authorizeSmartStocksBusiness,
  isUuid,
  smartStocksJsonError,
} from "@/lib/smart-stocks/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SCOPE = "parchi-reject";

interface RouteContext {
  params: { captureId: string };
}

export const POST = withWorkspaceMutation<RouteContext>(
  async (_request, auth, context) => {
    const captureId = context.params.captureId;

    if (!isUuid(captureId)) {
      return smartStocksJsonError(SCOPE, "Invalid parchi.", 400);
    }

    const supabase = createAdminSupabaseClient();
    const { data: capture, error } = await supabase
      .from("document_captures")
      .select("id, business_id")
      .eq("id", captureId)
      .maybeSingle();

    if (error) {
      return smartStocksJsonError(SCOPE, error.message, 500);
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

    const { data: updated, error: updateError } = await supabase
      .from("document_captures")
      .update({ status: "rejected" })
      .eq("id", captureId)
      .eq("business_id", access.business.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return smartStocksJsonError(SCOPE, updateError.message, 500);
    }

    if (!updated) {
      return smartStocksJsonError(SCOPE, "This parchi was already posted or rejected.", 409);
    }

    return NextResponse.json({ success: true, capture_id: captureId });
  },
  { permission: "edit_ledgers" }
);
