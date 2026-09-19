import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit-logs";
import { verifyPanWithNsdl } from "@/lib/kyc/verification";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      pan?: string;
      context?: "agent" | "business";
      business_id?: string;
    } | null;

    if (!body?.pan?.trim()) {
      return NextResponse.json({ error: "PAN is required." }, { status: 400 });
    }

    const context = body.context ?? "agent";
    const verification = await verifyPanWithNsdl(body.pan);

    if (!verification.valid) {
      return NextResponse.json({ error: verification.message }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const verifiedAt = new Date().toISOString();

    if (context === "agent") {
      const agent = await requireActiveAgent(request);

      if ("error" in agent) {
        return agent.error;
      }

      const { data, error } = await supabase
        .from("agents")
        .update({
          pan_number: body.pan.trim().toUpperCase(),
          pan_verified_at: verifiedAt,
          kyc_verified_at: null,
        })
        .eq("id", agent.agentId)
        .select("pan_number, pan_verified_at, bank_verified_at, kyc_verified_at")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Failed to save PAN verification." },
          { status: 500 }
        );
      }

      if (data.bank_verified_at) {
        await supabase
          .from("agents")
          .update({ kyc_verified_at: verifiedAt })
          .eq("id", agent.agentId);
      }

      await writeAuditLog(supabase, {
        actorId: agent.userId,
        action: "kyc.pan_verified",
        resourceType: "agent",
        resourceId: agent.agentId,
        metadata: { provider: verification.provider },
      });

      return NextResponse.json({
        verified: true,
        message: verification.message,
        pan_verified_at: verifiedAt,
      });
    }

    const auth = await requireAuthenticatedUser(request);

    if ("error" in auth) {
      return auth.error;
    }

    const businessId = body.business_id?.trim();

    if (!businessId) {
      return NextResponse.json(
        { error: "business_id is required for merchant verification." },
        { status: 400 }
      );
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, user_id, payout_pan")
      .eq("id", businessId)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    await supabase
      .from("businesses")
      .update({
        payout_pan: body.pan.trim().toUpperCase(),
        pan_verified_at: verifiedAt,
      })
      .eq("id", businessId);

    await writeAuditLog(supabase, {
      actorId: auth.userId,
      action: "kyc.pan_verified",
      resourceType: "business",
      resourceId: businessId,
      metadata: { provider: verification.provider },
    });

    return NextResponse.json({
      verified: true,
      message: verification.message,
      pan_verified_at: verifiedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify PAN.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
