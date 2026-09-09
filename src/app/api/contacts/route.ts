import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { upsertContactForUser } from "@/lib/contact-upsert";
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
        "id, user_id, name, phone_number, email, client_gstin, billing_address, wallet_balance, created_at"
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

export const POST = withWorkspaceMutation(async (request, auth) => {
  const body = (await request.json()) as {
    contact_name?: string;
    phone_number?: string;
    contact_email?: string | null;
  };

  if (!body.contact_name?.trim()) {
    return NextResponse.json({ error: "contact_name is required." }, { status: 400 });
  }

  if (!body.phone_number?.trim()) {
    return NextResponse.json({ error: "phone_number is required." }, { status: 400 });
  }

  try {
    const result = await upsertContactForUser(auth.effectiveUserId, {
      contactName: body.contact_name,
      phoneNumber: body.phone_number,
      contactEmail: body.contact_email ?? null,
    });

    return NextResponse.json(
      { contact: result.contact, created: result.isNew },
      { status: result.isNew ? 201 : 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save contact.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { permission: "edit_ledgers" });
