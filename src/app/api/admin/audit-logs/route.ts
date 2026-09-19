import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSuperAdminUser(request);

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 250);

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select(
        `
        id,
        action,
        resource_type,
        resource_id,
        metadata,
        created_at,
        actor:actor_id (
          email,
          full_name
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load audit logs." },
        { status: 500 }
      );
    }

    return NextResponse.json({ logs: data ?? [] });
  } catch (loadError) {
    const message =
      loadError instanceof Error ? loadError.message : "Failed to load audit logs.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
