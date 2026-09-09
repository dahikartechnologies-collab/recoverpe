import { SupabaseClient } from "@supabase/supabase-js";
import { WorkspaceAuthContext } from "@/lib/auth-gateway";
import { WorkspaceMode } from "@/types";

export interface DataAccessScope {
  restrictToAssignedUserId: string | null;
}

function hasFullWorkspaceDataAccess(auth: WorkspaceAuthContext): boolean {
  return (
    auth.isOwner ||
    auth.customPermissions.manage_team === true ||
    auth.customPermissions.export_data === true
  );
}

export function resolveDataAccessScope(auth: WorkspaceAuthContext): DataAccessScope {
  if (hasFullWorkspaceDataAccess(auth)) {
    return { restrictToAssignedUserId: null };
  }

  return { restrictToAssignedUserId: auth.actorUserId };
}

export function shouldRestrictToAssignedLedgers(
  isOwner: boolean,
  manageTeam: boolean,
  exportData: boolean
): boolean {
  return !(isOwner || manageTeam || exportData);
}

export async function fetchAssignedLedgerIds(
  supabase: SupabaseClient,
  workspaceUserId: string,
  actorUserId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<string[]> {
  let query = supabase
    .from("ledgers")
    .select("id")
    .eq("user_id", workspaceUserId)
    .eq("assigned_to_user_id", actorUserId);

  if (workspaceMode === "personal") {
    query = query.is("business_id", null);
  } else if (businessId) {
    query = query.eq("business_id", businessId);
  } else {
    return [];
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to resolve assigned ledger scope.");
  }

  return (data ?? []).map((row) => row.id as string);
}

export async function fetchAssignedContactIds(
  supabase: SupabaseClient,
  workspaceUserId: string,
  actorUserId: string,
  businessId: string | null
): Promise<string[]> {
  let query = supabase
    .from("ledgers")
    .select("contact_id")
    .eq("user_id", workspaceUserId)
    .eq("assigned_to_user_id", actorUserId);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to resolve assigned contact scope.");
  }

  const ids = new Set<string>();

  for (const row of data ?? []) {
    if (row.contact_id) {
      ids.add(row.contact_id as string);
    }
  }

  return Array.from(ids);
}
