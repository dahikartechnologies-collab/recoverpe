import { NextResponse } from "next/server";
import { withWorkspaceAuth } from "@/lib/auth-gateway";
import { BUSINESS_SELECT } from "@/lib/business-select";
import { validateBusinessSettingsUpdate } from "@/lib/business-settings-validation";
import { parseSmtpSettings } from "@/lib/notification-settings";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase-authenticated";
import { Business, SubscriptionPlan } from "@/types";

const BUSINESS_SELECT_FIELDS = BUSINESS_SELECT;

interface RouteContext {
  params: { id: string };
}

export const PATCH = withWorkspaceAuth<RouteContext>(
  async (request, auth, context) => {
    const businessId = context.params.id?.trim();

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
    }

    const body = (await request.json()) as {
      msme_reg_no?: string | null;
      khata_auto_approve?: boolean;
      business_name?: string;
      business_address?: string | null;
      gstin?: string | null;
      notification_preferences?: Business["notification_preferences"];
      smtp_settings?: Business["smtp_settings"];
      autopilot_schedule?: number[];
    };

    const adminSupabase = createAdminSupabaseClient();
    const { data: ownerUser } = await adminSupabase
      .from("users")
      .select("subscription_plan")
      .eq("id", auth.workspaceUserId)
      .maybeSingle();

    const validation = validateBusinessSettingsUpdate(body, {
      subscriptionPlan:
        (ownerUser?.subscription_plan as SubscriptionPlan | undefined) ?? "free",
    });

    if (validation.error || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updatePayload = { ...validation.data };

    if (updatePayload.smtp_settings && !updatePayload.smtp_settings.pass) {
      const { data: existingBusiness } = await adminSupabase
        .from("businesses")
        .select("smtp_settings")
        .eq("id", businessId)
        .eq("user_id", auth.workspaceUserId)
        .maybeSingle();

      const existingSmtp = parseSmtpSettings(existingBusiness?.smtp_settings);

      if (existingSmtp.pass) {
        updatePayload.smtp_settings = {
          ...updatePayload.smtp_settings,
          pass: existingSmtp.pass,
        };
      }
    }

    const userSupabase = createAuthenticatedSupabaseClient(auth.idToken);
    const { data, error } = await userSupabase
      .from("businesses")
      .update(updatePayload)
      .eq("id", businessId)
      .eq("user_id", auth.workspaceUserId)
      .select(BUSINESS_SELECT_FIELDS)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to update business profile." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      business: data as Business,
      message: "Business settings saved successfully.",
    });
  },
  { requiredPermission: "edit_settings" }
);

export const DELETE = withWorkspaceAuth<RouteContext>(
  async (request, auth, context) => {
    const businessId = context.params.id?.trim();

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
    }

    const userSupabase = createAuthenticatedSupabaseClient(auth.idToken);
    const { data: deletedRow, error } = await userSupabase
      .from("businesses")
      .delete()
      .eq("id", businessId)
      .eq("user_id", auth.actorUserId)
      .select("id")
      .maybeSingle();

    if (deletedRow) {
      return NextResponse.json({
        success: true,
        message: "Business deleted successfully.",
      });
    }

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to delete business." },
        { status: 500 }
      );
    }

    const adminSupabase = createAdminSupabaseClient();
    const { data: adminDeletedRow, error: adminError } = await adminSupabase
      .from("businesses")
      .delete()
      .eq("id", businessId)
      .eq("user_id", auth.actorUserId)
      .select("id")
      .maybeSingle();

    if (adminError || !adminDeletedRow) {
      return NextResponse.json(
        {
          error:
            "Forbidden. Only the business owner can delete this business.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Business deleted successfully.",
    });
  },
  { ownerOnly: true }
);
