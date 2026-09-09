import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { getAdminAppInstance } from "@/lib/firebase-admin";
import { fulfillMicroTransaction } from "@/lib/micro-transaction-fulfillment";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

interface RouteContext {
  params: { id: string };
}

async function assertLegalNoticeAccess(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  ledgerId: string,
  existingPdfUrl: string | null
): Promise<void> {
  if (existingPdfUrl) {
    return;
  }

  const { data: paidOrder, error } = await supabase
    .from("razorpay_orders")
    .select("id")
    .eq("user_id", userId)
    .eq("ledger_id", ledgerId)
    .eq("purchase_type", "legal_notice_999")
    .eq("status", "paid")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to verify legal notice purchase.");
  }

  if (!paidOrder) {
    throw new Error("Legal notice has not been purchased for this ledger.");
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const ledgerId = context.params.id?.trim();

    if (!ledgerId) {
      return NextResponse.json({ error: "Ledger ID is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    const { data: ledgerRow, error: ledgerError } = await supabase
      .from("ledgers")
      .select("legal_notice_pdf_url")
      .eq("id", ledgerId)
      .eq("user_id", contextResult.effectiveUserId)
      .maybeSingle();

    if (ledgerError || !ledgerRow) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    await assertLegalNoticeAccess(
      supabase,
      contextResult.effectiveUserId,
      ledgerId,
      ledgerRow.legal_notice_pdf_url as string | null
    );

    if (!ledgerRow.legal_notice_pdf_url) {
      await fulfillMicroTransaction(
        supabase,
        contextResult.effectiveUserId,
        ledgerId,
        "legal_notice_999"
      );
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!bucketName) {
      return NextResponse.json(
        { error: "Firebase storage bucket is not configured." },
        { status: 500 }
      );
    }

    const bucket = getStorage(getAdminAppInstance()).bucket(bucketName);
    const file = bucket.file(`secure/legal_notices/${ledgerId}.pdf`);
    const [pdfBuffer] = await file.download();

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="legal-notice-${ledgerId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to download legal notice.";

    const status = message.includes("not been purchased") ? 403 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
