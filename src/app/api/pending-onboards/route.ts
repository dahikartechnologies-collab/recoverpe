import { NextResponse } from "next/server";
import { logAndRespondDatabaseError } from "@/lib/api-error-response";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { fetchPendingOnboardsForBusiness } from "@/lib/pending-onboards";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("business_id")?.trim() ?? "";

    if (!businessId) {
      return NextResponse.json(
        { error: "business_id is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, khata_auto_approve")
      .eq("id", businessId)
      .eq("user_id", contextResult.effectiveUserId)
      .maybeSingle();

    if (businessError || !business) {
      if (businessError) {
        return logAndRespondDatabaseError(
          "pending-onboards GET business lookup",
          businessError
        );
      }

      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const pendingOnboards = await fetchPendingOnboardsForBusiness(
      supabase,
      contextResult.effectiveUserId,
      businessId
    );

    return NextResponse.json({
      pending_onboards: pendingOnboards,
      khata_auto_approve: Boolean(business.khata_auto_approve),
    });
  } catch (error) {
    return logAndRespondDatabaseError("pending-onboards GET", error);
  }
}
