import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  fetchEvidenceForLedger,
  isEvidenceFileType,
} from "@/lib/evidence-queries";
import { uploadEvidenceToFirebaseStorage } from "@/lib/firebase/storage";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { EvidenceFileType } from "@/types";

interface RouteContext {
  params: { id: string };
}

function inferEvidenceFileType(
  fileName: string,
  requestedType: string | null
): EvidenceFileType {
  if (requestedType && isEvidenceFileType(requestedType)) {
    return requestedType;
  }

  const lowerName = fileName.toLowerCase();

  if (lowerName.includes("pod") || lowerName.includes("delivery")) {
    return "POD";
  }

  if (lowerName.includes("contract") || lowerName.includes("agreement")) {
    return "Contract";
  }

  if (/\.(jpg|jpeg|png)$/i.test(lowerName)) {
    return "Photo";
  }

  if (/\.pdf$/i.test(lowerName)) {
    return "Invoice";
  }

  return "Other";
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
    const ledger = await fetchLedgerById(
      supabase,
      contextResult.effectiveUserId,
      ledgerId
    );

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    const attachments = await fetchEvidenceForLedger(
      supabase,
      contextResult.effectiveUserId,
      ledgerId
    );

    return NextResponse.json({ attachments });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load evidence vault.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withWorkspaceMutation<RouteContext>(
  async (request, auth, context) => {
    const ledgerId = context.params.id?.trim();

    if (!ledgerId) {
      return NextResponse.json({ error: "Ledger ID is required." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const requestedType = formData.get("file_type");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Evidence file is required." }, { status: 400 });
    }

    const contentType = file.type || "application/octet-stream";
    const supabase = createAdminSupabaseClient();
    const ledger = await fetchLedgerById(
      supabase,
      auth.effectiveUserId,
      ledgerId
    );

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadEvidenceToFirebaseStorage({
      businessId: ledger.business_id,
      userId: auth.effectiveUserId,
      ledgerId,
      fileName: file.name,
      fileBuffer,
      contentType,
    });
    const fileType = inferEvidenceFileType(
      file.name,
      typeof requestedType === "string" ? requestedType : null
    );

    const { data: attachment, error: insertError } = await supabase
      .from("evidence_attachments")
      .insert({
        ledger_id: ledgerId,
        user_id: auth.effectiveUserId,
        file_name: file.name,
        storage_path: uploadResult.storagePath,
        file_type: fileType,
      })
      .select(
        "id, ledger_id, user_id, file_name, storage_path, file_type, uploaded_at"
      )
      .single();

    if (insertError || !attachment) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to save evidence record." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        attachment,
        download_url: uploadResult.downloadUrl,
      },
      { status: 201 }
    );
  },
  { permission: "edit_ledgers" }
);
