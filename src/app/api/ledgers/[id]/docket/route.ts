import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { buildLegalDocketPdfProps } from "@/lib/legal-docket";
import { renderLegalDocketPdfBuffer } from "@/lib/pdf";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

interface RouteContext {
  params: { id: string };
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
    const props = await buildLegalDocketPdfProps(
      supabase,
      contextResult.effectiveUserId,
      ledgerId
    );
    const pdfBuffer = await renderLegalDocketPdfBuffer(props);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="legal-docket-${ledgerId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate legal docket.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
