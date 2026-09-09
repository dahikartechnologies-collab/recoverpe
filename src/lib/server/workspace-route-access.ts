import { cookies } from "next/headers";
import { ACTOR_USER_COOKIE, WORKSPACE_USER_COOKIE } from "@/lib/cookie-constants";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { parseCustomPermissions } from "@/lib/workspace-permissions";
import {
  canAccessDashboardHome,
  canAccessSettingsArea,
  WorkspaceNavContext,
} from "@/lib/workspace-nav-policy";
import { AppRole, OWNER_CUSTOM_PERMISSIONS } from "@/types";

export async function resolveWorkspaceRouteContextFromCookies(): Promise<WorkspaceNavContext | null> {
  const cookieStore = cookies();
  const actorUserId = cookieStore.get(ACTOR_USER_COOKIE)?.value ?? null;

  if (!actorUserId) {
    return null;
  }

  const workspaceUserId =
    cookieStore.get(WORKSPACE_USER_COOKIE)?.value ?? actorUserId;
  const isOwnWorkspaceContext = actorUserId === workspaceUserId;

  if (isOwnWorkspaceContext) {
    return {
      isOwnWorkspaceContext: true,
      role: "owner",
      permissions: { ...OWNER_CUSTOM_PERMISSIONS },
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("role, custom_permissions, status")
    .eq("member_user_id", actorUserId)
    .eq("workspace_user_id", workspaceUserId)
    .eq("status", "accepted")
    .maybeSingle();

  if (error || !membership) {
    return {
      isOwnWorkspaceContext: false,
      role: null,
      permissions: parseCustomPermissions(null),
    };
  }

  return {
    isOwnWorkspaceContext: false,
    role: membership.role as AppRole,
    permissions: parseCustomPermissions(membership.custom_permissions),
  };
}

export async function resolveWorkspaceRouteAccess(): Promise<{
  context: WorkspaceNavContext | null;
  canAccessDashboardHome: boolean;
  canAccessSettings: boolean;
}> {
  const context = await resolveWorkspaceRouteContextFromCookies();

  if (!context) {
    return {
      context: null,
      canAccessDashboardHome: true,
      canAccessSettings: true,
    };
  }

  return {
    context,
    canAccessDashboardHome: canAccessDashboardHome(context),
    canAccessSettings: canAccessSettingsArea(context),
  };
}
