import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { formatIndianPhoneNumber } from "@/lib/invoices";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Contact } from "@/types";

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    if (!phone?.trim()) {
      return NextResponse.json(
        { error: "phone query parameter is required." },
        { status: 400 }
      );
    }

    const formattedPhone = formatIndianPhoneNumber(phone);
    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, user_id, name, phone_number, client_gstin, billing_address, created_at"
      )
      .eq("user_id", contextResult.effectiveUserId)
      .eq("phone_number", formattedPhone)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to lookup contact." },
        { status: 500 }
      );
    }

    return NextResponse.json({ contact: (data as Contact | null) ?? null });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to lookup contact.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
