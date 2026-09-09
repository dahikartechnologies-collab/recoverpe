import { NextResponse } from "next/server";
import { uploadPaymentProofScreenshot } from "@/lib/firebase-storage-admin";
import {
  ALLOWED_PAYMENT_PROOF_MIME_TYPES,
  isAllowedPaymentProofMimeType,
  MAX_PAYMENT_PROOF_BYTES,
  resolveTrustedPaymentProofMimeType,
} from "@/lib/payment-proof-upload";
import { enforcePayVerifyUploadRateLimit } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

interface RouteContext {
  params: { id: string };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const rateLimitResponse = await enforcePayVerifyUploadRateLimit(request);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const ledgerId = context.params.id?.trim();

    if (!ledgerId) {
      return NextResponse.json({ error: "Ledger ID is required." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("screenshot");
    const claimedAmountRaw = formData.get("claimed_amount");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Payment screenshot file is required." },
        { status: 400 }
      );
    }

    if (file.size > MAX_PAYMENT_PROOF_BYTES) {
      return NextResponse.json(
        { error: "Payment proof must be 2MB or smaller." },
        { status: 400 }
      );
    }

    const declaredType = (file.type || "").trim().toLowerCase();

    if (!declaredType || !isAllowedPaymentProofMimeType(declaredType)) {
      return NextResponse.json(
        {
          error:
            "Payment proof must be JPEG, PNG, WEBP, or PDF.",
          allowed_types: ALLOWED_PAYMENT_PROOF_MIME_TYPES,
        },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    if (fileBuffer.byteLength > MAX_PAYMENT_PROOF_BYTES) {
      return NextResponse.json(
        { error: "Payment proof must be 2MB or smaller." },
        { status: 400 }
      );
    }

    const trustedMimeType = resolveTrustedPaymentProofMimeType({
      declaredType,
      fileBuffer,
    });

    if (!trustedMimeType) {
      return NextResponse.json(
        {
          error:
            "Payment proof content does not match an allowed file type.",
          allowed_types: ALLOWED_PAYMENT_PROOF_MIME_TYPES,
        },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { data: ledgerRow, error: ledgerError } = await supabase
      .from("ledgers")
      .select("id, user_id, balance_due, status")
      .eq("id", ledgerId)
      .maybeSingle();

    if (ledgerError || !ledgerRow) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    if (
      Number(ledgerRow.balance_due) <= 0 ||
      ["paid", "cancelled", "refunded"].includes(ledgerRow.status as string)
    ) {
      return NextResponse.json(
        { error: "This ledger is already settled." },
        { status: 400 }
      );
    }

    const screenshotUrl = await uploadPaymentProofScreenshot(
      ledgerId,
      fileBuffer,
      trustedMimeType
    );

    let claimedAmount: number | null = null;

    if (typeof claimedAmountRaw === "string" && claimedAmountRaw.trim()) {
      const parsed = Number.parseFloat(claimedAmountRaw);

      if (Number.isFinite(parsed) && parsed > 0) {
        claimedAmount = parsed;
      }
    }

    const { data: verification, error: insertError } = await supabase
      .from("payment_verifications")
      .insert({
        ledger_id: ledgerId,
        user_id: ledgerRow.user_id,
        screenshot_url: screenshotUrl,
        claimed_amount: claimedAmount,
        status: "pending",
      })
      .select("id, ledger_id, status, submitted_at")
      .single();

    if (insertError || !verification) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to submit payment proof." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Payment proof submitted. The merchant will verify and update your ledger.",
        verification,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit payment proof.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
