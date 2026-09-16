import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import { updateAgentBankProfile } from "@/lib/agent/profile";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const agent = await requireActiveAgent(request);

  if ("error" in agent) {
    return agent.error;
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      bank_account_name?: string;
      bank_account_number?: string;
      bank_ifsc?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const profile = await updateAgentBankProfile(supabase, agent.agentId, {
      bankAccountName: body.bank_account_name ?? "",
      bankAccountNumber: body.bank_account_number ?? "",
      bankIfsc: body.bank_ifsc ?? "",
    });

    return NextResponse.json({ profile });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save bank profile.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
