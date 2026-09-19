import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit-logs";
import { verifyBankPennyDrop } from "@/lib/kyc/verification";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      account_number?: string;
      ifsc?: string;
      account_holder_name?: string;
      context?: "agent" | "business";
      business_id?: string;
    } | null;

    if (!body?.account_number?.trim() || !body?.ifsc?.trim()) {
      return NextResponse.json(
        { error: "Account number and IFSC are required." },
        { status: 400 }
      );
    }

    const context = body.context ?? "agent";
    const verification = await verifyBankPennyDrop({
      accountNumber: body.account_number,
      ifsc: body.ifsc,
      accountHolderName: body.account_holder_name ?? "",
    });

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

      const { error } = await supabase
        .from("agents")
        .update({
          bank_account_number: body.account_number.replace(/\s/g, ""),
          bank_ifsc: body.ifsc.trim().toUpperCase(),
          bank_account_name: body.account_holder_name?.trim() || null,
          bank_verified_at: verifiedAt,
        })
        .eq("id", agent.agentId);

      if (error) {
        return NextResponse.json(
          { error: error.message || "Failed to save bank verification." },
          { status: 500 }
        );
      }

      const { data: profile } = await supabase
        .from("agents")
        .select("pan_verified_at")
        .eq("id", agent.agentId)
        .single();

      if (profile?.pan_verified_at) {
        await supabase
          .from("agents")
          .update({ kyc_verified_at: verifiedAt })
          .eq("id", agent.agentId);
      }

      await writeAuditLog(supabase, {
        actorId: agent.userId,
        action: "kyc.bank_verified",
        resourceType: "agent",
        resourceId: agent.agentId,
        metadata: {
          provider: verification.provider,
          reference_id: verification.referenceId ?? null,
        },
      });

      return NextResponse.json({
        verified: true,
        message: verification.message,
        bank_verified_at: verifiedAt,
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
      .select("id")
      .eq("id", businessId)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    await supabase
      .from("businesses")
      .update({
        payout_bank_account_number: body.account_number.replace(/\s/g, ""),
        payout_bank_ifsc: body.ifsc.trim().toUpperCase(),
        payout_account_holder_name: body.account_holder_name?.trim() || null,
        bank_verified_at: verifiedAt,
      })
      .eq("id", businessId);

    await writeAuditLog(supabase, {
      actorId: auth.userId,
      action: "kyc.bank_verified",
      resourceType: "business",
      resourceId: businessId,
      metadata: {
        provider: verification.provider,
        reference_id: verification.referenceId ?? null,
      },
    });

    return NextResponse.json({
      verified: true,
      message: verification.message,
      bank_verified_at: verifiedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify bank account.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
