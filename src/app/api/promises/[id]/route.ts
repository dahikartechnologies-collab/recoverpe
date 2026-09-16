import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { PromiseStatus } from "@/types";

const ALLOWED_STATUSES = new Set<PromiseStatus>(["kept", "broken", "void"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const { id } = await context.params;
    const body = (await request.json()) as { status?: PromiseStatus };
    const nextStatus = body.status;

    if (!nextStatus || !ALLOWED_STATUSES.has(nextStatus)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("payment_promises")
      .update({ status: nextStatus })
      .eq("id", id)
      .eq("user_id", contextResult.effectiveUserId)
      .select("id, status")
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to update promise.");
    }

    if (!data) {
      return NextResponse.json({ error: "Promise not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, promise: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update promise.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
