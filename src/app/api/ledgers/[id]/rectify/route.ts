import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { refreshContactRiskScoreAsync } from "@/lib/contact-risk-score";
import { rectifyLedger } from "@/lib/ledger-rectify";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { RectifyLedgerPayload } from "@/types";

interface RouteContext {
  params: { id: string };
}

export const POST = withWorkspaceMutation<RouteContext>(
  async (request, auth, context) => {
    try {
      const ledgerId = context.params.id?.trim();

      if (!ledgerId) {
        return NextResponse.json({ error: "Ledger ID is required." }, { status: 400 });
      }

      const body = (await request.json()) as RectifyLedgerPayload;

      if (!body.rectification_reason?.trim()) {
        return NextResponse.json(
          { error: "Rectification reason is required." },
          { status: 400 }
        );
      }

      if (!Number.isFinite(body.total_amount) || body.total_amount <= 0) {
        return NextResponse.json(
          { error: "Total amount must be a positive number." },
          { status: 400 }
        );
      }

      if (!body.due_date?.trim()) {
        return NextResponse.json({ error: "Due date is required." }, { status: 400 });
      }

      const supabase = createAdminSupabaseClient();
      const ledger = await rectifyLedger(
        supabase,
        auth.effectiveUserId,
        ledgerId,
        {
          total_amount: body.total_amount,
          due_date: body.due_date,
          rectification_reason: body.rectification_reason,
          invoice_number: body.invoice_number,
        }
      );

      refreshContactRiskScoreAsync(supabase, ledger.contact_id);

      return NextResponse.json({ ledger });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rectify ledger.";

      const status = message.includes("not found") ? 404 : 400;

      return NextResponse.json({ error: message }, { status });
    }
  },
  { permission: "edit_ledgers" }
);
