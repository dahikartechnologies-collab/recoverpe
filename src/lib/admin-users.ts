import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { AdminManagedUser, AdminUserManageAction } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

export function deriveDisplayName(email: string): string {
  const localPart = email.split("@")[0]?.trim();

  if (!localPart) {
    return email;
  }

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export async function fetchAllAdminUsers(): Promise<AdminManagedUser[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, phone_number, subscription_plan, account_status, eligible_for_discount, is_super_admin, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load users.");
  }

  return (data ?? []).map((user) => ({
    id: user.id as string,
    name: deriveDisplayName(user.email as string),
    email: user.email as string,
    phone_number: user.phone_number as string,
    subscription_plan: user.subscription_plan as AdminManagedUser["subscription_plan"],
    account_status: user.account_status as AdminManagedUser["account_status"],
    eligible_for_discount: Boolean(user.eligible_for_discount),
    is_super_admin: Boolean(user.is_super_admin),
    created_at: user.created_at as string,
  }));
}

async function getTargetUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  id: string;
  is_super_admin: boolean;
  account_status: string;
}> {
  const { data, error } = await supabase
    .from("users")
    .select("id, is_super_admin, account_status")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Target user not found.");
  }

  return data as {
    id: string;
    is_super_admin: boolean;
    account_status: string;
  };
}

export async function executeAdminUserAction(
  actingAdminUserId: string,
  targetUserId: string,
  action: AdminUserManageAction
): Promise<AdminManagedUser> {
  if (actingAdminUserId === targetUserId) {
    throw new Error("You cannot perform admin actions on your own account.");
  }

  const supabase = createAdminSupabaseClient();
  const targetUser = await getTargetUser(supabase, targetUserId);

  if (targetUser.is_super_admin && action === "suspend") {
    throw new Error("Super admin accounts cannot be suspended.");
  }

  if (action === "suspend") {
    const { error: suspendError } = await supabase
      .from("users")
      .update({ account_status: "suspended" })
      .eq("id", targetUserId);

    if (suspendError) {
      throw new Error(suspendError.message || "Failed to suspend user.");
    }

    const { error: pauseError } = await supabase
      .from("ledgers")
      .update({ communication_paused: true })
      .eq("user_id", targetUserId);

    if (pauseError) {
      throw new Error(
        pauseError.message || "User suspended but failed to pause automations."
      );
    }
  }

  if (action === "unsuspend") {
    const { error: unsuspendError } = await supabase
      .from("users")
      .update({ account_status: "active" })
      .eq("id", targetUserId);

    if (unsuspendError) {
      throw new Error(unsuspendError.message || "Failed to unsuspend user.");
    }
  }

  if (action === "grant_discount") {
    const { error: discountError } = await supabase
      .from("users")
      .update({ eligible_for_discount: true })
      .eq("id", targetUserId);

    if (discountError) {
      throw new Error(discountError.message || "Failed to grant discount eligibility.");
    }
  }

  const { data: updatedUser, error: reloadError } = await supabase
    .from("users")
    .select(
      "id, email, phone_number, subscription_plan, account_status, eligible_for_discount, is_super_admin, created_at"
    )
    .eq("id", targetUserId)
    .single();

  if (reloadError || !updatedUser) {
    throw new Error(reloadError?.message || "Action completed but user refresh failed.");
  }

  return {
    id: updatedUser.id as string,
    name: deriveDisplayName(updatedUser.email as string),
    email: updatedUser.email as string,
    phone_number: updatedUser.phone_number as string,
    subscription_plan:
      updatedUser.subscription_plan as AdminManagedUser["subscription_plan"],
    account_status: updatedUser.account_status as AdminManagedUser["account_status"],
    eligible_for_discount: Boolean(updatedUser.eligible_for_discount),
    is_super_admin: Boolean(updatedUser.is_super_admin),
    created_at: updatedUser.created_at as string,
  };
}

export async function fetchSuspendedUserIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("account_status", "suspended");

  if (error) {
    throw new Error(error.message || "Failed to load suspended users.");
  }

  return new Set((data ?? []).map((row) => row.id as string));
}
