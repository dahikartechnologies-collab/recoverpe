import { NextResponse } from "next/server";
import {
  ghostModeWriteBlockedResponse,
  resolveEffectiveUserContext,
} from "@/lib/api-auth";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { UpdateLedgerPayload } from "@/types";

interface RouteContext {
  params: { id: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const supabase = createAdminSupabaseClient();
    const ledger = await fetchLedgerById(
      supabase,
      contextResult.effectiveUserId,
      context.params.id
    );

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    return NextResponse.json({ ledger });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load ledger.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const ghostBlocked = ghostModeWriteBlockedResponse(contextResult);
    if (ghostBlocked) {
      return ghostBlocked;
    }

    const body = (await request.json()) as UpdateLedgerPayload;

    if (typeof body.communication_paused !== "boolean") {
      return NextResponse.json(
        { error: "communication_paused must be a boolean." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const existingLedger = await fetchLedgerById(
      supabase,
      contextResult.effectiveUserId,
      context.params.id
    );

    if (!existingLedger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("ledgers")
      .update({ communication_paused: body.communication_paused })
      .eq("id", context.params.id)
      .eq("user_id", contextResult.effectiveUserId)
      .select(
        "id, user_id, contact_id, business_id, invoice_number, source_type, total_amount, balance_due, due_date, status, is_custom_pdf, pdf_url, current_version, communication_paused, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to update ledger." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ledger: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update ledger.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
