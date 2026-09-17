import { NextResponse } from "next/server";
import { fetchDebtorPortalPaymentStatus } from "@/lib/portal-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token?.trim();

    if (!token) {
      return NextResponse.json({ error: "Portal token is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const status = await fetchDebtorPortalPaymentStatus(supabase, token);

    if (!status) {
      return NextResponse.json({ error: "Portal link is invalid or expired." }, { status: 404 });
    }

    return NextResponse.json(status);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load portal status.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
