import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { grantBusinessTierAccess } from "@/lib/admin-grant-tier";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { AdminGrantBusinessTierPayload, Tier } from "@/types";

function isGrantTier(value: string): value is Extract<Tier, "business" | "premium"> {
  return value === "business" || value === "premium";
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const businessId = context.params.id?.trim();

    if (!businessId) {
      return NextResponse.json({ error: "Business id is required." }, { status: 400 });
    }

    const body = (await request.json()) as Partial<AdminGrantBusinessTierPayload>;
    const tier = body.tier?.trim() ?? "";
    const days = Number(body.days);

    if (!isGrantTier(tier)) {
      return NextResponse.json(
        { error: "tier must be business or premium." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(days) || days <= 0) {
      return NextResponse.json(
        { error: "days must be a positive number." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const business = await grantBusinessTierAccess(supabase, businessId, {
      tier,
      days: Math.trunc(days),
    });

    return NextResponse.json({
      success: true,
      business,
      message: `${tier.charAt(0).toUpperCase()}${tier.slice(1)} access granted for ${Math.trunc(days)} day(s).`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to grant tier access.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
