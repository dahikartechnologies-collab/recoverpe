import { NextResponse } from "next/server";
import {
  getRequestedBusinessIdFromRequest,
  resolveEffectiveUserContext,
} from "@/lib/api-auth";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { getBusinessesForActorContext } from "@/lib/accessible-workspaces";
import { BUSINESS_SELECT } from "@/lib/business-select";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Business, CreateBusinessPayload } from "@/types";

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const businesses = await getBusinessesForActorContext(
      contextResult.actorUserId,
      contextResult.effectiveUserId,
      getRequestedBusinessIdFromRequest(request)
    );

    return NextResponse.json({ businesses });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load business profiles.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withWorkspaceMutation(async (request, auth) => {
  const body = (await request.json()) as CreateBusinessPayload;

  if (!body.business_name?.trim()) {
    return NextResponse.json(
      { error: "Business name is required." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .insert({
      user_id: auth.effectiveUserId,
      business_name: body.business_name.trim(),
      gstin: body.gstin?.trim() || null,
      logo_url: body.logo_url?.trim() || null,
    })
    .select(BUSINESS_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to create business profile." },
      { status: 500 }
    );
  }

  return NextResponse.json({ business: data as Business }, { status: 201 });
}, { ownerOnly: true });
