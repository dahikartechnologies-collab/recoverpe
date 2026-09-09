import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { searchWorkspace } from "@/lib/vendor-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const supabase = createAdminSupabaseClient();
    const results = await searchWorkspace(
      supabase,
      contextResult.effectiveUserId,
      query
    );

    return NextResponse.json({ results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search workspace.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
