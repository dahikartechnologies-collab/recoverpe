import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { getDebtorPortalUrl } from "@/lib/app-url";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { resolveBusinessIdForContact } from "@/lib/virtual-account-queries";
import { fetchContactDirectory } from "@/lib/vendor-queries";

interface RouteContext {
  params: { id: string };
}

interface PortalLinkBody {
  business_id?: string | null;
}

const PORTAL_LINK_TTL_DAYS = 7;

async function resolveVendorContact(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  contactId: string,
  businessId: string | null
) {
  const { data: directContact, error: directContactError } = await supabase
    .from("contacts")
    .select("id, name, phone_number")
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();

  if (directContactError) {
    throw new Error(directContactError.message || "Failed to load vendor contact.");
  }

  if (directContact) {
    return {
      contact_id: directContact.id as string,
      contact_name: directContact.name as string,
      phone_number: directContact.phone_number as string,
    };
  }

  const directory = await fetchContactDirectory(supabase, userId, {
    limit: 1,
    offset: 0,
    contactId,
    businessId,
  });

  return directory.contacts[0] ?? null;
}

export const POST = withWorkspaceMutation<RouteContext>(
  async (request, auth, context) => {
    try {
      const contactId = context.params.id?.trim();

      if (!contactId) {
        return NextResponse.json({ error: "Vendor id is required." }, { status: 400 });
      }

      const body = (await request.json().catch(() => ({}))) as PortalLinkBody;
      const supabase = createAdminSupabaseClient();

      const businessId = await resolveBusinessIdForContact(
        supabase,
        auth.effectiveUserId,
        contactId,
        body.business_id ?? null
      );

      const contact = await resolveVendorContact(
        supabase,
        auth.effectiveUserId,
        contactId,
        businessId
      );

      if (!contact) {
        return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + PORTAL_LINK_TTL_DAYS);

      const { data: session, error: sessionError } = await supabase
        .from("debtor_portal_sessions")
        .insert({
          user_id: auth.effectiveUserId,
          contact_id: contactId,
          expires_at: expiresAt.toISOString(),
        })
        .select("id, expires_at")
        .single();

      if (sessionError || !session) {
        console.error("[portal-link] debtor_portal_sessions insert failed:", {
          message: sessionError?.message,
          code: sessionError?.code,
          details: sessionError?.details,
          hint: sessionError?.hint,
          contactId,
          userId: auth.effectiveUserId,
        });

        return NextResponse.json(
          { error: sessionError?.message || "Failed to create portal session." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        url: getDebtorPortalUrl(session.id as string),
        session_id: session.id,
        expires_at: session.expires_at,
      });
    } catch (error) {
      console.error("[portal-link] Unhandled error:", error);

      if (error instanceof Error) {
        console.error("[portal-link] message:", error.message);
        console.error("[portal-link] stack:", error.stack);
      }

      const message =
        error instanceof Error ? error.message : "Failed to generate portal link.";

      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { permission: "edit_ledgers" }
);
