import { NextResponse } from "next/server";
import { requireActorIdentity } from "@/lib/identity-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const identityResult = await requireActorIdentity(request);

    if ("error" in identityResult) {
      return identityResult.error;
    }

    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from("users")
      .update({
        account_status: "pending_purge",
        updated_at: new Date().toISOString(),
      })
      .eq("id", identityResult.actorUserId)
      .neq("account_status", "pending_purge")
      .select("id, email, account_status")
      .single();

    if (error || !data) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("account_status")
        .eq("id", identityResult.actorUserId)
        .maybeSingle();

      if (existingUser?.account_status === "pending_purge") {
        return NextResponse.json({
          success: true,
          message: "Your account is already scheduled for deletion.",
          account_status: "pending_purge",
        });
      }

      return NextResponse.json(
        { error: error?.message || "Failed to schedule account deletion." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Your account and data have been scheduled for deletion per DPDP compliance.",
      account_status: data.account_status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to schedule account deletion.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
