import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { provisionRazorpayVirtualAccount } from "@/lib/razorpay-virtual-account";
import {
  fetchVirtualAccountForContact,
  resolveBusinessIdForContact,
} from "@/lib/virtual-account-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { fetchContactDirectory } from "@/lib/vendor-queries";

interface RouteContext {
  params: { id: string };
}

interface ProvisionVirtualAccountBody {
  business_id?: string | null;
}

interface ProvisionedVirtualAccountDetails {
  providerReferenceId: string;
  virtualUpiId: string | null;
  virtualAccountNumber: string | null;
  ifscCode: string | null;
  simulated: boolean;
}

const VENDOR_CONTACT_ERROR =
  "Vendor must have a valid phone number or email to create a Virtual Account.";

function shouldUseDevVirtualAccountBypass(): boolean {
  return isDevelopmentAppEnv() && !process.env.RAZORPAY_KEY_ID?.trim();
}

function buildDevVirtualAccountPayload(contactId: string): ProvisionedVirtualAccountDetails {
  const suffix = contactId.replace(/-/g, "").slice(0, 8);

  return {
    providerReferenceId: "va_mock_123",
    virtualUpiId: suffix ? `mock_upi_${suffix}@razorpay` : "mock_upi@razorpay",
    virtualAccountNumber: "1234567890123456",
    ifscCode: "RAZR0000000",
    simulated: true,
  };
}

function vendorHasValidContactChannel(phoneNumber: string | null | undefined): boolean {
  const phoneDigits = (phoneNumber ?? "").replace(/\D/g, "");
  return phoneDigits.length >= 10;
}

async function resolveVendorContact(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  contactId: string,
  businessId: string
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

      const body = (await request.json().catch(() => ({}))) as ProvisionVirtualAccountBody;
      const supabase = createAdminSupabaseClient();

      const businessId = await resolveBusinessIdForContact(
        supabase,
        auth.effectiveUserId,
        contactId,
        body.business_id ?? null
      );

      if (!businessId) {
        return NextResponse.json(
          {
            error:
              "A business profile is required before provisioning Smart Collect. Add a business workspace first.",
          },
          { status: 400 }
        );
      }

      const contact = await resolveVendorContact(
        supabase,
        auth.effectiveUserId,
        contactId,
        businessId
      );

      if (!contact) {
        return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
      }

      if (!vendorHasValidContactChannel(contact.phone_number)) {
        return NextResponse.json({ error: VENDOR_CONTACT_ERROR }, { status: 400 });
      }

      const existingVirtualAccount = await fetchVirtualAccountForContact(
        supabase,
        auth.effectiveUserId,
        contactId,
        businessId
      );

      if (existingVirtualAccount) {
        return NextResponse.json({
          virtual_account: existingVirtualAccount,
          simulated: false,
          already_exists: true,
        });
      }

      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("business_name")
        .eq("id", businessId)
        .eq("user_id", auth.effectiveUserId)
        .maybeSingle();

      if (businessError || !business) {
        console.error("[virtual-account] business lookup failed:", {
          businessId,
          message: businessError?.message,
          code: businessError?.code,
        });

        return NextResponse.json({ error: "Business not found." }, { status: 404 });
      }

      let provisioned: ProvisionedVirtualAccountDetails;

      if (shouldUseDevVirtualAccountBypass()) {
        console.info(
          "[virtual-account] Dev bypass active (APP_ENV=development, RAZORPAY_KEY_ID missing). Skipping Razorpay API."
        );
        provisioned = buildDevVirtualAccountPayload(contactId);
      } else {
        const { data: merchantUser } = await supabase
          .from("users")
          .select("email")
          .eq("id", auth.effectiveUserId)
          .maybeSingle();

        const merchantEmail = (merchantUser?.email as string | undefined) ?? null;

        try {
          provisioned = await provisionRazorpayVirtualAccount({
            vendorName: contact.contact_name,
            phoneNumber: contact.phone_number,
            email: merchantEmail,
            description: `Recoverpe Smart Collect — ${business.business_name} / ${contact.contact_name}`,
          });
        } catch (razorpayError) {
          console.error("[virtual-account] Razorpay provisioning failed:", razorpayError);

          const message =
            razorpayError instanceof Error
              ? razorpayError.message
              : "Failed to provision virtual account with Razorpay.";

          if (
            message.toLowerCase().includes("contact") ||
            message.toLowerCase().includes("phone") ||
            message.toLowerCase().includes("email")
          ) {
            return NextResponse.json({ error: VENDOR_CONTACT_ERROR }, { status: 400 });
          }

          return NextResponse.json({ error: message }, { status: 502 });
        }
      }

      const insertPayload = {
        user_id: auth.effectiveUserId,
        business_id: businessId,
        contact_id: contactId,
        provider: "razorpay" as const,
        virtual_upi_id: provisioned.virtualUpiId,
        virtual_account_number: provisioned.virtualAccountNumber,
        ifsc_code: provisioned.ifscCode,
        provider_reference_id: provisioned.providerReferenceId,
        status: "active" as const,
      };

      console.info("[virtual-account] Inserting virtual_accounts row:", {
        business_id: insertPayload.business_id,
        contact_id: insertPayload.contact_id,
        provider_reference_id: insertPayload.provider_reference_id,
        simulated: provisioned.simulated,
      });

      const { data: insertedVirtualAccount, error: insertError } = await supabase
        .from("virtual_accounts")
        .insert(insertPayload)
        .select(
          "id, user_id, business_id, contact_id, provider, virtual_upi_id, virtual_account_number, ifsc_code, provider_reference_id, status, created_at, updated_at"
        )
        .single();

      if (insertError || !insertedVirtualAccount) {
        console.error("[virtual-account] virtual_accounts insert failed:", {
          message: insertError?.message,
          code: insertError?.code,
          details: insertError?.details,
          hint: insertError?.hint,
          payload: insertPayload,
        });

        return NextResponse.json(
          { error: insertError?.message || "Failed to store virtual account." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          virtual_account: insertedVirtualAccount,
          simulated: provisioned.simulated,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("[virtual-account] Unhandled error:", error);

      if (error instanceof Error) {
        console.error("[virtual-account] message:", error.message);
        console.error("[virtual-account] stack:", error.stack);
      }

      const message =
        error instanceof Error
          ? error.message
          : "Failed to provision virtual account.";

      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { permission: "edit_settings" }
);
