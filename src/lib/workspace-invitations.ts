import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { AppRole, WorkspaceInvitation } from "@/types";

async function fetchPrimaryBusinessName(workspaceUserId: string): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("business_name")
    .eq("user_id", workspaceUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (business?.business_name) {
    return business.business_name as string;
  }

  const { data: user } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", workspaceUserId)
    .maybeSingle();

  return (
    (user?.full_name as string | undefined) ||
    (user?.email as string | undefined) ||
    "Workspace"
  );
}

export async function listPendingInvitationsForUser(
  actorUserId: string
): Promise<WorkspaceInvitation[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id, role, created_at, workspace_user_id, invitee_name")
    .eq("member_user_id", actorUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load workspace invitations.");
  }

  const invitations: WorkspaceInvitation[] = [];

  for (const row of data ?? []) {
    const workspaceUserId = row.workspace_user_id as string;
    const businessName = await fetchPrimaryBusinessName(workspaceUserId);

    invitations.push({
      id: row.id as string,
      role: row.role as Exclude<AppRole, "owner">,
      created_at: row.created_at as string,
      workspace_user_id: workspaceUserId,
      business_name: businessName,
      invitee_name: (row.invitee_name as string | null | undefined) ?? null,
    });
  }

  return invitations;
}

export async function respondToWorkspaceInvitation(
  actorUserId: string,
  invitationId: string,
  decision: "accepted" | "rejected"
): Promise<{ workspace_user_id: string; business_name: string }> {
  const supabase = createAdminSupabaseClient();
  const { data: invitation, error: fetchError } = await supabase
    .from("workspace_members")
    .select("id, member_user_id, workspace_user_id, status")
    .eq("id", invitationId)
    .maybeSingle();

  if (fetchError || !invitation) {
    throw new Error("Invitation not found.");
  }

  if (invitation.member_user_id !== actorUserId) {
    throw new Error("You can only respond to invitations sent to you.");
  }

  if (invitation.status !== "pending") {
    throw new Error("This invitation has already been responded to.");
  }

  const { error: updateError } = await supabase
    .from("workspace_members")
    .update({ status: decision })
    .eq("id", invitationId)
    .eq("member_user_id", actorUserId)
    .eq("status", "pending");

  if (updateError) {
    throw new Error(updateError.message || "Failed to update invitation.");
  }

  const businessName = await fetchPrimaryBusinessName(
    invitation.workspace_user_id as string
  );

  return {
    workspace_user_id: invitation.workspace_user_id as string,
    business_name: businessName,
  };
}
