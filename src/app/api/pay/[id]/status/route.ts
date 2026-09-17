import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ledgerId = params.id?.trim();

    if (!ledgerId) {
      return NextResponse.json({ error: "Ledger id is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("ledgers")
      .select("id, status, balance_due")
      .eq("id", ledgerId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    const balanceDue = Number(data.balance_due ?? 0);
    const status = data.status as string;
    const isPaid = balanceDue <= 0 || status === "paid";

    return NextResponse.json({
      ledger_id: data.id,
      status,
      balance_due: balanceDue,
      is_paid: isPaid,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load payment status.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
