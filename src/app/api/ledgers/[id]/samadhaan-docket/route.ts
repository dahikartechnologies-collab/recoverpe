import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { withWorkspaceAuth } from "@/lib/auth-gateway";
import { getAdminAppInstance } from "@/lib/firebase-admin";
import { ensureSamadhaanDocketForLedger } from "@/lib/micro-transaction-fulfillment";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  assertSpendFundsPermission,
  resolveWorkspaceAccess,
} from "@/lib/workspace-rbac";

interface RouteContext {
  params: { id: string };
}

export const GET = withWorkspaceAuth<RouteContext>(
  async (_request, auth, context) => {
    try {
      const ledgerId = context.params.id?.trim();

      if (!ledgerId) {
        return NextResponse.json({ error: "Ledger ID is required." }, { status: 400 });
      }

      const supabase = createAdminSupabaseClient();
      await ensureSamadhaanDocketForLedger(
        supabase,
        auth.effectiveUserId,
        ledgerId
      );

      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

      if (!bucketName) {
        return NextResponse.json(
          { error: "Firebase storage bucket is not configured." },
          { status: 500 }
        );
      }

      const bucket = getStorage(getAdminAppInstance()).bucket(bucketName);
      const file = bucket.file(`secure/samadhaan_dockets/${ledgerId}.pdf`);
      const [pdfBuffer] = await file.download();

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="samadhaan-docket-${ledgerId}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to download Samadhaan docket.";

      const status = message.includes("not been purchased") ? 403 : 500;

      return NextResponse.json({ error: message }, { status });
    }
  },
  { requiredPermission: "spend_funds" }
);

export async function POST(request: Request, context: RouteContext) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const access = await resolveWorkspaceAccess(
      contextResult.actorUserId,
      contextResult.effectiveUserId
    );

    try {
      assertSpendFundsPermission(access);
    } catch (permissionError) {
      return NextResponse.json(
        {
          error:
            permissionError instanceof Error
              ? permissionError.message
              : "Forbidden.",
        },
        { status: 403 }
      );
    }

    const ledgerId = context.params.id?.trim();

    if (!ledgerId) {
      return NextResponse.json({ error: "Ledger ID is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const fulfillment = await ensureSamadhaanDocketForLedger(
      supabase,
      contextResult.effectiveUserId,
      ledgerId
    );

    return NextResponse.json({
      success: true,
      pdf_url: fulfillment.pdf_url,
      samadhaan_meta: fulfillment.samadhaan_meta ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate Samadhaan docket.";

    const status = message.includes("not been purchased") ? 403 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
