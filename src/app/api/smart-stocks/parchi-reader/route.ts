import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  extractParchiWithGemini,
  isAllowedParchiMimeType,
  PARCHI_DEFAULT_CONFIDENCE,
  PARCHI_MAX_BYTES,
  PARCHI_SIGNED_URL_SECONDS,
  SMART_STOCKS_BUCKET,
} from "@/lib/smart-stocks/parchi-reader";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { DocumentCaptureRow } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUSINESS_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
}

async function ensureSmartStocksBucket(
  supabase: ReturnType<typeof createAdminSupabaseClient>
): Promise<void> {
  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error(error.message || "Failed to list storage buckets.");
  }

  if (buckets?.some((bucket) => bucket.id === SMART_STOCKS_BUCKET)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(
    SMART_STOCKS_BUCKET,
    {
      public: false,
      fileSizeLimit: PARCHI_MAX_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    }
  );

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(createError.message || "Failed to create the parchi storage bucket.");
  }
}

export const POST = withWorkspaceMutation(async (request, auth) => {
  const form = await request.formData();
  const businessId = String(form.get("business_id") || "").trim();
  const uploaded = form.get("file") ?? form.get("image");

  if (!BUSINESS_ID_PATTERN.test(businessId)) {
    return NextResponse.json(
      { error: "A valid business_id is required." },
      { status: 400 }
    );
  }

  if (!(uploaded instanceof File)) {
    return NextResponse.json(
      { error: "Upload the parchi image in the file field." },
      { status: 400 }
    );
  }

  const mimeType = uploaded.type || "image/jpeg";

  if (!isAllowedParchiMimeType(mimeType)) {
    return NextResponse.json(
      { error: "Parchi images must be JPEG, PNG, or WebP." },
      { status: 400 }
    );
  }

  if (uploaded.size <= 0 || uploaded.size > PARCHI_MAX_BYTES) {
    return NextResponse.json(
      { error: "Parchi image must be between 1 byte and 4MB." },
      { status: 400 }
    );
  }

  if (!auth.isOwner && auth.role !== "admin") {
    return NextResponse.json(
      { error: "Only the workspace owner or an admin can read supplier bills." },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError) {
    return NextResponse.json({ error: businessError.message }, { status: 500 });
  }

  if (!business) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  if (business.user_id !== auth.workspaceUserId) {
    return NextResponse.json(
      { error: "Forbidden. This business belongs to another workspace." },
      { status: 403 }
    );
  }

  const imageBuffer = Buffer.from(await uploaded.arrayBuffer());
  const storagePath = `${businessId}/${randomUUID()}.${extensionForMime(mimeType)}`;

  await ensureSmartStocksBucket(supabase);

  const { error: uploadError } = await supabase.storage
    .from(SMART_STOCKS_BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message || "Failed to store the parchi image." },
      { status: 500 }
    );
  }

  try {
    const extraction = await extractParchiWithGemini({
      imageBase64: imageBuffer.toString("base64"),
      mimeType,
    });

    const { data: signed, error: signedError } = await supabase.storage
      .from(SMART_STOCKS_BUCKET)
      .createSignedUrl(storagePath, PARCHI_SIGNED_URL_SECONDS);

    if (signedError || !signed?.signedUrl) {
      throw new Error(signedError?.message || "Failed to sign the parchi image URL.");
    }

    const { data: capture, error: insertError } = await supabase
      .from("document_captures")
      .insert({
        business_id: businessId,
        photo_url: signed.signedUrl,
        raw_ai_json: extraction,
        confidence_score: PARCHI_DEFAULT_CONFIDENCE,
        status: "pending",
      })
      .select(
        "id, business_id, photo_url, raw_ai_json, confidence_score, status, created_at, updated_at"
      )
      .single();

    if (insertError || !capture) {
      throw new Error(insertError?.message || "Failed to save the parchi reading.");
    }

    return NextResponse.json({
      success: true,
      document_capture: capture as DocumentCaptureRow,
    });
  } catch (error) {
    await supabase.storage.from(SMART_STOCKS_BUCKET).remove([storagePath]);

    const message =
      error instanceof Error ? error.message : "Failed to read the parchi.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}, { permission: "edit_ledgers" });
