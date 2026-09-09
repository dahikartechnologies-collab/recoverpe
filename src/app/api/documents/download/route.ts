import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { createShortLivedSignedUrl } from "@/lib/firebase-storage-admin";
import {
  LedgerDocumentType,
  parseLedgerDocumentType,
  resolveLedgerDocumentPath,
} from "@/lib/document-storage";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

const LEDGER_DOCUMENT_COLUMNS: Record<
  LedgerDocumentType,
  "pdf_url" | "legal_notice_pdf_url" | "samadhaan_docket_pdf_url"
> = {
  invoice: "pdf_url",
  "legal-notice": "legal_notice_pdf_url",
  "samadhaan-docket": "samadhaan_docket_pdf_url",
};

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const { searchParams } = new URL(request.url);
    const ledgerId = searchParams.get("id")?.trim();
    const documentType = parseLedgerDocumentType(searchParams.get("type"));

    if (!ledgerId) {
      return NextResponse.json({ error: "Document id is required." }, { status: 400 });
    }

    if (!documentType) {
      return NextResponse.json(
        { error: "Invalid document type. Use invoice, legal-notice, or samadhaan-docket." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const column = LEDGER_DOCUMENT_COLUMNS[documentType];

    const { data: ledgerRow, error: ledgerError } = await supabase
      .from("ledgers")
      .select(`id, user_id, ${column}`)
      .eq("id", ledgerId)
      .eq("user_id", contextResult.effectiveUserId)
      .maybeSingle();

    if (ledgerError || !ledgerRow) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    const storedValue =
      (ledgerRow as Record<string, string | null | undefined>)[column] ?? null;
    const storagePath = resolveLedgerDocumentPath(
      storedValue,
      documentType,
      ledgerId
    );

    if (!storedValue || !storagePath) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const signedUrl = await createShortLivedSignedUrl(storagePath);

    return NextResponse.redirect(signedUrl, { status: 307 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to download document.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
