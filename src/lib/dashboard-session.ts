import { NextResponse } from "next/server";
import { countUserLedgers } from "@/lib/razorpay";
import {
  getRequestedBusinessIdFromRequest,
  resolveEffectiveUserContext,
} from "@/lib/api-auth";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import {
  getBusinessesForActorContext,
  listAccessibleBusinesses,
} from "@/lib/accessible-workspaces";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { RecoverpeUser } from "@/types";
import { DashboardSessionPayload } from "@/lib/dashboard-session-types";

export type { DashboardSessionPayload };

const USER_PROFILE_SELECT =
  "id, firebase_uid, email, phone_number, full_name, billing_address, alternate_phone, default_upi_vpa, subscription_plan, premium_expires_at, recovery_upsell_shown, vapi_wallet_balance, is_super_admin, account_status, eligible_for_discount, created_at";

export async function loadDashboardSession(
  request: Request
): Promise<DashboardSessionPayload | { error: NextResponse }> {
  const contextResult = await resolveEffectiveUserContext(request);

  if ("error" in contextResult) {
    return { error: contextResult.error };
  }

  const authResult = await resolveWorkspaceAuth(request);

  if ("error" in authResult) {
    return { error: authResult.error };
  }

  const supabase = createAdminSupabaseClient();
  const profileUserId = contextResult.isGhostMode
    ? contextResult.effectiveUserId
    : contextResult.actorUserId;

  const [userResult, ledgerCount, accessible, businesses] = await Promise.all([
    supabase
      .from("users")
      .select(USER_PROFILE_SELECT)
      .eq("id", profileUserId)
      .single(),
    countUserLedgers(supabase, profileUserId),
    listAccessibleBusinesses(contextResult.actorUserId),
    getBusinessesForActorContext(
      contextResult.actorUserId,
      contextResult.effectiveUserId,
      getRequestedBusinessIdFromRequest(request)
    ),
  ]);

  if (userResult.error || !userResult.data) {
    throw new Error("User profile not found.");
  }

  const user: RecoverpeUser = {
    ...(userResult.data as Omit<RecoverpeUser, "ledger_count">),
    is_super_admin: Boolean(userResult.data.is_super_admin),
    account_status:
      (userResult.data.account_status as RecoverpeUser["account_status"]) ??
      "active",
    eligible_for_discount: Boolean(userResult.data.eligible_for_discount),
    recovery_upsell_shown: Boolean(userResult.data.recovery_upsell_shown),
    premium_expires_at:
      (userResult.data.premium_expires_at as string | null) ?? null,
    ledger_count: ledgerCount,
  };

  return {
    user,
    ghost_mode: {
      active: contextResult.isGhostMode,
      impersonated_user_id: contextResult.isGhostMode
        ? contextResult.effectiveUserId
        : null,
      impersonated_user_email: contextResult.impersonatedUserEmail,
    },
    role: {
      role: authResult.role,
      workspace_user_id: authResult.workspaceUserId,
      business_name: null,
      custom_permissions: authResult.customPermissions,
    },
    accessible_workspaces: accessible,
    unique_workspace_count: accessible.length,
    businesses,
  };
}
