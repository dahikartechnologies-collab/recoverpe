import { NextResponse } from "next/server";
import {
  ghostModeWriteBlockedResponse,
  resolveEffectiveUserContext,
} from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Business, CreateBusinessPayload } from "@/types";

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id, user_id, business_name, gstin, logo_url, invoice_prefix, financial_year_suffix, next_invoice_sequence, created_at"
      )
      .eq("user_id", contextResult.effectiveUserId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load business profiles." },
        { status: 500 }
      );
    }

    return NextResponse.json({ businesses: (data ?? []) as Business[] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load business profiles.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const ghostBlocked = ghostModeWriteBlockedResponse(contextResult);
    if (ghostBlocked) {
      return ghostBlocked;
    }

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
        user_id: contextResult.effectiveUserId,
        business_name: body.business_name.trim(),
        gstin: body.gstin?.trim() || null,
        logo_url: body.logo_url?.trim() || null,
      })
      .select(
        "id, user_id, business_name, gstin, logo_url, invoice_prefix, financial_year_suffix, next_invoice_sequence, created_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to create business profile." },
        { status: 500 }
      );
    }

    return NextResponse.json({ business: data as Business }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create business profile.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
