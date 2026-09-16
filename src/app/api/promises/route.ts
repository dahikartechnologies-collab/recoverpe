import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { PaymentPromiseRecord } from "@/types";

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("business_id")?.trim() ?? null;
    const status = searchParams.get("status")?.trim() ?? null;

    const supabase = createAdminSupabaseClient();
    let query = supabase
      .from("payment_promises")
      .select(
        "id, user_id, business_id, contact_id, ledger_id, promised_on, promised_amount, source, status, created_at, contacts(name)"
      )
      .eq("user_id", contextResult.effectiveUserId)
      .order("promised_on", { ascending: false })
      .limit(100);

    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    if (status && ["open", "kept", "broken", "void"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || "Failed to load payment promises.");
    }

    const promises: PaymentPromiseRecord[] = (data ?? []).map((row) => {
      const contact = row.contacts as { name?: string } | null;

      return {
        id: row.id as string,
        user_id: row.user_id as string,
        business_id: (row.business_id as string | null) ?? null,
        contact_id: row.contact_id as string,
        ledger_id: (row.ledger_id as string | null) ?? null,
        promised_on: row.promised_on as string,
        promised_amount: Number(row.promised_amount),
        source: row.source as PaymentPromiseRecord["source"],
        status: row.status as PaymentPromiseRecord["status"],
        created_at: row.created_at as string,
        contact_name: contact?.name,
      };
    });

    return NextResponse.json({ promises });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load promises.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
