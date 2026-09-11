import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { fetchContactCommunicationHistory } from "@/lib/communication-logs";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const MAX_HISTORY_LIMIT = 100;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const context = await resolveEffectiveUserContext(request);

  if ("error" in context) {
    return context.error;
  }

  try {
    const supabase = createAdminSupabaseClient();
    const requestedLimit = Number(
      new URL(request.url).searchParams.get("limit") ?? "50"
    );
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_HISTORY_LIMIT)
        : 50;

    // Confirm the contact belongs to the effective workspace before reading
    // its message history.
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", context.effectiveUserId)
      .maybeSingle();

    if (contactError) {
      return NextResponse.json({ error: contactError.message }, { status: 500 });
    }

    if (!contact) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    const communications = await fetchContactCommunicationHistory(
      supabase,
      context.effectiveUserId,
      params.id,
      limit
    );

    return NextResponse.json({ communications });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load communication history.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
