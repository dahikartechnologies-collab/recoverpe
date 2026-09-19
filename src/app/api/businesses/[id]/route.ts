import { NextResponse } from "next/server";
import { withWorkspaceAuth } from "@/lib/auth-gateway";
import { logAndRespondDatabaseError } from "@/lib/api-error-response";
import { BUSINESS_SELECT } from "@/lib/business-select";
import { validateBusinessSettingsUpdate } from "@/lib/business-settings-validation";
import { parseSmtpSettings } from "@/lib/notification-settings";
import { cancelBusinessSubscriptionIfActive } from "@/lib/subscription-lifecycle";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Business, SubscriptionPlan } from "@/types";

const BUSINESS_SELECT_FIELDS = BUSINESS_SELECT;

interface RouteContext {
  params: { id: string };
}

export const PATCH = withWorkspaceAuth<RouteContext>(
  async (request, auth, context) => {
    try {
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

      console.log("[PATCH /api/businesses] Incoming payload:", JSON.stringify(body));
      console.log("[PATCH /api/businesses] Auth context:", {
        actorUserId: auth.actorUserId,
        workspaceUserId: auth.workspaceUserId,
        businessId,
        role: auth.role,
        isOwner: auth.isOwner,
      });

      const adminSupabase = createAdminSupabaseClient();

      const { data: ownedBusiness, error: ownershipError } = await adminSupabase
        .from("businesses")
        .select("id, smtp_settings")
        .eq("id", businessId)
        .eq("user_id", auth.workspaceUserId)
        .maybeSingle();

      if (ownershipError) {
        return logAndRespondDatabaseError(
          "businesses PATCH ownership lookup",
          ownershipError
        );
      }

      if (!ownedBusiness) {
        return NextResponse.json({ error: "Business not found." }, { status: 404 });
      }

      const { data: ownerUser, error: ownerLookupError } = await adminSupabase
        .from("users")
        .select("subscription_plan")
        .eq("id", auth.workspaceUserId)
        .maybeSingle();

      if (ownerLookupError) {
        return logAndRespondDatabaseError(
          "businesses PATCH owner lookup",
          ownerLookupError
        );
      }

      const validation = validateBusinessSettingsUpdate(body, {
        subscriptionPlan:
          (ownerUser?.subscription_plan as SubscriptionPlan | undefined) ?? "free",
      });

      if (validation.error || !validation.data) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const updatePayload = { ...validation.data };

      if (updatePayload.smtp_settings && !updatePayload.smtp_settings.pass) {
        const existingSmtp = parseSmtpSettings(ownedBusiness.smtp_settings);

        if (existingSmtp.pass) {
          updatePayload.smtp_settings = {
            ...updatePayload.smtp_settings,
            pass: existingSmtp.pass,
          };
        }
      }

      console.log(
        "[PATCH /api/businesses] Sanitized update payload:",
        JSON.stringify(updatePayload)
      );

      const { data, error } = await adminSupabase
        .from("businesses")
        .update(updatePayload)
        .eq("id", businessId)
        .eq("user_id", auth.workspaceUserId)
        .select(BUSINESS_SELECT_FIELDS)
        .single();

      if (error || !data) {
        return logAndRespondDatabaseError(
          "businesses PATCH update",
          error ?? new Error("No business row returned.")
        );
      }

      return NextResponse.json({
        success: true,
        business: data as Business,
        message: "Business settings saved successfully.",
      });
    } catch (error) {
      return logAndRespondDatabaseError("businesses PATCH", error);
    }
  },
  { requiredPermission: "edit_settings" }
);

export const DELETE = withWorkspaceAuth<RouteContext>(
  async (request, auth, context) => {
    try {
      const businessId = context.params.id?.trim();

      if (!businessId) {
        return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
      }

      const adminSupabase = createAdminSupabaseClient();

      await cancelBusinessSubscriptionIfActive(adminSupabase, businessId);

      const { data: deletedRow, error } = await adminSupabase
        .from("businesses")
        .delete()
        .eq("id", businessId)
        .eq("user_id", auth.actorUserId)
        .select("id")
        .maybeSingle();

      if (error) {
        return logAndRespondDatabaseError("businesses DELETE", error);
      }

      if (!deletedRow) {
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
    } catch (error) {
      return logAndRespondDatabaseError("businesses DELETE", error);
    }
  },
  { ownerOnly: true }
);
