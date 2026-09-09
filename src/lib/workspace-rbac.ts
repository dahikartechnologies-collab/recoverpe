import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  getDefaultPermissionsForRole,
  parseCustomPermissions,
} from "@/lib/workspace-permissions";
import {
  AppRole,
  Business,
  CustomPermissions,
  OWNER_CUSTOM_PERMISSIONS,
  WorkspaceRoleContext,
} from "@/types";

export type { AppRole, WorkspaceRoleContext };

export type BusinessSubscriptionTier = Business["subscription_tier"];

/**
 * Server-side premium gate. Never trust client toggles — always read subscription_tier
 * from the businesses row (or pass the value loaded server-side).
 */
export function isPremiumBusiness(
  business: Pick<Business, "subscription_tier"> | null | undefined
): boolean {
  return business?.subscription_tier === "premium";
}

export interface WorkspaceAccessContext {
  role: AppRole;
  workspace_user_id: string;
  can_manage: boolean;
  is_owner: boolean;
  custom_permissions: CustomPermissions;
}

const MEMBER_ROLE_PRIORITY: AppRole[] = [
  "admin",
  "recovery_agent",
  "accountant",
  "field_staff",
];

function buildRoleContext(
  role: AppRole,
  workspaceUserId: string,
  businessName: string | null,
  customPermissions?: CustomPermissions | null
): WorkspaceRoleContext {
  return {
    role,
    workspace_user_id: workspaceUserId,
    business_name: businessName,
    custom_permissions: resolveEffectivePermissionsForRole(role, customPermissions),
  };
}

function resolveEffectivePermissionsForRole(
  role: AppRole,
  customPermissions?: CustomPermissions | null
): CustomPermissions {
  if (role === "owner") {
    return { ...OWNER_CUSTOM_PERMISSIONS };
  }

  if (customPermissions) {
    return { ...customPermissions };
  }

  if (role === "field_staff") {
    return getDefaultPermissionsForRole("field_staff");
  }

  return getDefaultPermissionsForRole(
    role as Exclude<AppRole, "owner" | "field_staff">
  );
}

export async function resolveWorkspaceRoleContext(
  userId: string
): Promise<WorkspaceRoleContext> {
  const supabase = createAdminSupabaseClient();

  const { count: ownedLedgerCount, error: ownedLedgerError } = await supabase
    .from("ledgers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (ownedLedgerError) {
    throw new Error(ownedLedgerError.message || "Failed to resolve workspace role.");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role, workspace_user_id, custom_permissions")
    .eq("member_user_id", userId)
    .eq("status", "accepted");

  if (membershipError) {
    throw new Error(membershipError.message || "Failed to resolve workspace role.");
  }

  if ((ownedLedgerCount ?? 0) > 0) {
    return buildRoleContext("owner", userId, await fetchPrimaryBusinessName(supabase, userId));
  }

  for (const role of MEMBER_ROLE_PRIORITY) {
    const membership = (memberships ?? []).find((entry) => entry.role === role);

    if (membership) {
      const workspaceUserId = membership.workspace_user_id as string;
      const businessName = await fetchPrimaryBusinessName(supabase, workspaceUserId);
      const customPermissions = parseCustomPermissions(membership.custom_permissions);

      if (role === "field_staff") {
        return buildRoleContext("field_staff", workspaceUserId, businessName, customPermissions);
      }

      return buildRoleContext(
        role as Extract<AppRole, "admin" | "recovery_agent" | "accountant">,
        workspaceUserId,
        businessName,
        customPermissions
      );
    }
  }

  return buildRoleContext("owner", userId, await fetchPrimaryBusinessName(supabase, userId));
}

export async function resolveWorkspaceRoleForUser(
  actorUserId: string,
  workspaceUserId: string
): Promise<WorkspaceRoleContext> {
  if (actorUserId === workspaceUserId) {
    return resolveWorkspaceRoleContext(actorUserId);
  }

  const supabase = createAdminSupabaseClient();

  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("role, workspace_user_id, status, custom_permissions")
    .eq("member_user_id", actorUserId)
    .eq("workspace_user_id", workspaceUserId)
    .maybeSingle();

  if (error || !membership || membership.status !== "accepted") {
    throw new Error("You do not have access to this workspace.");
  }

  const role = membership.role as AppRole;
  const customPermissions = parseCustomPermissions(membership.custom_permissions);
  const businessName = await fetchPrimaryBusinessName(supabase, workspaceUserId);

  if (role === "field_staff") {
    return buildRoleContext("field_staff", workspaceUserId, businessName, customPermissions);
  }

  return buildRoleContext(
    role as Extract<AppRole, "admin" | "recovery_agent" | "accountant">,
    workspaceUserId,
    businessName,
    customPermissions
  );
}

async function fetchPrimaryBusinessName(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  workspaceUserId: string
): Promise<string | null> {
  const { data: business } = await supabase
    .from("businesses")
    .select("business_name")
    .eq("user_id", workspaceUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (business?.business_name as string | undefined) ?? null;
}

export async function fetchLedgerForCollection(
  actorUserId: string,
  ledgerId: string
): Promise<{
  id: string;
  user_id: string;
  contact_id: string;
  balance_due: number;
  assigned_to_user_id: string | null;
} | null> {
  const supabase = createAdminSupabaseClient();

  const { data: ledger, error } = await supabase
    .from("ledgers")
    .select("id, user_id, contact_id, balance_due, assigned_to_user_id")
    .eq("id", ledgerId)
    .maybeSingle();

  if (error || !ledger) {
    return null;
  }

  if (ledger.user_id === actorUserId) {
    return ledger as {
      id: string;
      user_id: string;
      contact_id: string;
      balance_due: number;
      assigned_to_user_id: string | null;
    };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, workspace_user_id, status, custom_permissions")
    .eq("member_user_id", actorUserId)
    .eq("workspace_user_id", ledger.user_id)
    .maybeSingle();

  if (!membership || membership.status !== "accepted") {
    return null;
  }

  const permissions = parseCustomPermissions(membership.custom_permissions);

  if (permissions.edit_ledgers) {
    return ledger as {
      id: string;
      user_id: string;
      contact_id: string;
      balance_due: number;
      assigned_to_user_id: string | null;
    };
  }

  if (ledger.assigned_to_user_id === actorUserId) {
    return ledger as {
      id: string;
      user_id: string;
      contact_id: string;
      balance_due: number;
      assigned_to_user_id: string | null;
    };
  }

  return null;
}

export async function resolveWorkspaceAccess(
  actorUserId: string,
  workspaceUserId?: string
): Promise<WorkspaceAccessContext> {
  const targetWorkspaceUserId = workspaceUserId ?? actorUserId;

  if (actorUserId === targetWorkspaceUserId) {
    return {
      role: "owner",
      workspace_user_id: targetWorkspaceUserId,
      can_manage: true,
      is_owner: true,
      custom_permissions: { ...OWNER_CUSTOM_PERMISSIONS },
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("role, workspace_user_id, status, custom_permissions")
    .eq("member_user_id", actorUserId)
    .eq("workspace_user_id", targetWorkspaceUserId)
    .maybeSingle();

  if (error || !membership || membership.status !== "accepted") {
    throw new Error("You do not have access to this workspace.");
  }

  const role = membership.role as AppRole;
  const custom_permissions = parseCustomPermissions(membership.custom_permissions);

  return {
    role,
    workspace_user_id: targetWorkspaceUserId,
    can_manage: custom_permissions.manage_team,
    is_owner: false,
    custom_permissions,
  };
}

export function assertWorkspacePermission(
  access: WorkspaceAccessContext,
  permission: keyof CustomPermissions,
  message?: string
): void {
  if (access.is_owner) {
    return;
  }

  if (!access.custom_permissions[permission]) {
    throw new Error(message || "You do not have permission to perform this action.");
  }
}

export function assertSpendFundsPermission(access: WorkspaceAccessContext): void {
  if (access.is_owner || access.custom_permissions.spend_funds) {
    return;
  }

  throw new Error(
    "You do not have permission to initiate paid transactions."
  );
}
