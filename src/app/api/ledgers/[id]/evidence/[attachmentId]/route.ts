import { NextResponse } from "next/server";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { createShortLivedSignedUrl } from "@/lib/firebase-storage-admin";
import {
  buildMockEvidenceDownloadUrl,
  isFirebaseStorageConfigured,
} from "@/lib/firebase/storage";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { fetchEvidenceAttachmentById } from "@/lib/evidence-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

interface RouteContext {
  params: { id: string; attachmentId: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const ledgerId = context.params.id?.trim();
    const attachmentId = context.params.attachmentId?.trim();

    if (!ledgerId || !attachmentId) {
      return NextResponse.json(
        { error: "Ledger ID and attachment ID are required." },
        { status: 400 }
      );
    }

    const result = await (async () => {
      const contextResult = await resolveEffectiveUserContext(request);

      if ("error" in contextResult) {
        return { error: contextResult.error };
      }

      const supabase = createAdminSupabaseClient();
      const attachment = await fetchEvidenceAttachmentById(
        supabase,
        contextResult.effectiveUserId,
        ledgerId,
        attachmentId
      );

      if (!attachment) {
        return {
          error: NextResponse.json(
            { error: "Evidence file not found." },
            { status: 404 }
          ),
        };
      }

      return { attachment };
    })();

    if ("error" in result && result.error) {
      return result.error;
    }

    if (!isFirebaseStorageConfigured()) {
      if (isDevelopmentAppEnv()) {
        return NextResponse.redirect(
          buildMockEvidenceDownloadUrl(result.attachment.storage_path),
          { status: 307 }
        );
      }

      return NextResponse.json(
        { error: "Firebase storage bucket is not configured." },
        { status: 500 }
      );
    }

    const signedUrl = await createShortLivedSignedUrl(result.attachment.storage_path);

    return NextResponse.redirect(signedUrl, { status: 307 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to download evidence file.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
