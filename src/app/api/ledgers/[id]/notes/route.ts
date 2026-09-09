import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { LedgerNote, LedgerNotesResponse } from "@/types";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const contextResult = await resolveEffectiveUserContext(_request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const ledgerId = context.params.id?.trim();

    if (!ledgerId) {
      return NextResponse.json({ error: "Ledger id is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const ledger = await fetchLedgerById(
      supabase,
      contextResult.effectiveUserId,
      ledgerId
    );

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("ledger_notes")
      .select(
        `
        id,
        ledger_id,
        user_id,
        note_text,
        created_at,
        users:user_id (
          full_name,
          email
        )
      `
      )
      .eq("ledger_id", ledgerId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load ledger notes." },
        { status: 500 }
      );
    }

    const notes: LedgerNote[] = (data ?? []).map((row) => {
      const author = Array.isArray(row.users) ? row.users[0] : row.users;

      return {
        id: row.id as string,
        ledger_id: row.ledger_id as string,
        user_id: row.user_id as string,
        note_text: row.note_text as string,
        created_at: row.created_at as string,
        author_name:
          (author?.full_name as string | null | undefined) ||
          (author?.email as string | undefined) ||
          "Team member",
      };
    });

    const response: LedgerNotesResponse = { notes };
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load ledger notes.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withWorkspaceMutation<RouteContext>(
  async (request, auth, context) => {
    const ledgerId = context.params.id?.trim();

    if (!ledgerId) {
      return NextResponse.json({ error: "Ledger id is required." }, { status: 400 });
    }

    const body = (await request.json()) as { note_text?: string };
    const noteText = body.note_text?.trim();

    if (!noteText) {
      return NextResponse.json({ error: "note_text is required." }, { status: 400 });
    }

    if (auth.role === "accountant") {
      return NextResponse.json(
        { error: "Accountants have read-only access and cannot post notes." },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const ledger = await fetchLedgerById(
      supabase,
      auth.effectiveUserId,
      ledgerId
    );

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("ledger_notes")
      .insert({
        ledger_id: ledgerId,
        user_id: auth.actorUserId,
        note_text: noteText,
      })
      .select("id, ledger_id, user_id, note_text, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to add ledger note." },
        { status: 500 }
      );
    }

    const { data: author } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", auth.actorUserId)
      .maybeSingle();

    const note: LedgerNote = {
      id: data.id as string,
      ledger_id: data.ledger_id as string,
      user_id: data.user_id as string,
      note_text: data.note_text as string,
      created_at: data.created_at as string,
      author_name:
        (author?.full_name as string | null | undefined) ||
        (author?.email as string | undefined) ||
        "Team member",
    };

    return NextResponse.json({ note }, { status: 201 });
  },
  { permission: "edit_ledgers" }
);
