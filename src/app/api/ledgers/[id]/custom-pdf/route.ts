import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  MAX_CUSTOM_PDF_BYTES,
  uploadCustomLedgerPdf,
} from "@/lib/firebase-storage-admin";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Ledger } from "@/types";

interface RouteContext {
  params: { id: string };
}

export const POST = withWorkspaceMutation<RouteContext>(
  async (request, auth, context) => {
    const ledgerId = context.params.id?.trim();

    if (!ledgerId) {
      return NextResponse.json({ error: "Ledger ID is required." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("pdf");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Uploaded file must be a PDF document." },
        { status: 400 }
      );
    }

    if (file.size > MAX_CUSTOM_PDF_BYTES) {
      return NextResponse.json(
        { error: "PDF must be 4MB or smaller." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const existingLedger = await fetchLedgerById(
      supabase,
      auth.effectiveUserId,
      ledgerId
    );

    if (!existingLedger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    if (existingLedger.is_custom_pdf && existingLedger.pdf_url) {
      return NextResponse.json(
        { error: "This ledger already has a custom PDF attached." },
        { status: 409 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const pdfUrl = await uploadCustomLedgerPdf(ledgerId, fileBuffer);

    const { data: updatedLedger, error: updateError } = await supabase
      .from("ledgers")
      .update({
        pdf_url: pdfUrl,
        is_custom_pdf: true,
      })
      .eq("id", ledgerId)
      .eq("user_id", auth.effectiveUserId)
      .select(
        "id, user_id, contact_id, business_id, invoice_number, source_type, total_amount, balance_due, due_date, status, is_custom_pdf, pdf_url, current_version, communication_paused, created_at, updated_at"
      )
      .single();

    if (updateError || !updatedLedger) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to attach custom PDF." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ledger: updatedLedger as Ledger });
  },
  { permission: "edit_ledgers" }
);
