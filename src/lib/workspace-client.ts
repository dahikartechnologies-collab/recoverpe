import { getAuthHeaders } from "@/lib/auth-headers";
import {
  AssignVendorAgentPayload,
  AccessibleWorkspacesResponse,
  CustomPermissions,
  InviteWorkspaceMemberPayload,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceMembersResponse,
} from "@/types";

export async function fetchWorkspaceMembers(): Promise<WorkspaceMember[]> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/workspace/members", { headers });
  const body = (await response.json()) as WorkspaceMembersResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load team members.");
  }

  return body.members;
}

export async function inviteWorkspaceMember(
  payload: InviteWorkspaceMemberPayload
): Promise<WorkspaceMember> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/workspace/members", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as {
    member?: WorkspaceMember;
    error?: string;
  };

  if (!response.ok || !body.member) {
    throw new Error(body.error || "Failed to invite team member.");
  }

  return body.member;
}

export async function assignVendorCollectionAgent(
  contactId: string,
  payload: AssignVendorAgentPayload
): Promise<{ updated_ledger_count: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/vendors/${contactId}/assign-agent`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as {
    updated_ledger_count?: number;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to assign collection agent.");
  }

  return {
    updated_ledger_count: body.updated_ledger_count ?? 0,
  };
}

export async function fetchAccessibleWorkspaces(): Promise<AccessibleWorkspacesResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/workspaces/accessible", { headers });
  const body = (await response.json()) as AccessibleWorkspacesResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load accessible workspaces.");
  }

  return body;
}

export async function updateWorkspaceMember(
  memberId: string,
  role: WorkspaceMember["role"],
  custom_permissions: CustomPermissions
): Promise<WorkspaceMember> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/workspace/members/${memberId}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role, custom_permissions }),
  });

  const body = (await response.json()) as {
    member?: WorkspaceMember;
    error?: string;
  };

  if (!response.ok || !body.member) {
    throw new Error(body.error || "Failed to update team member.");
  }

  return body.member;
}

export async function removeWorkspaceMember(memberId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/workspace/members/${memberId}`, {
    method: "DELETE",
    headers,
  });

  const body = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Failed to remove team member.");
  }
}

export async function fetchWorkspaceInvitations(): Promise<WorkspaceInvitation[]> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/workspace/invitations", { headers });
  const body = (await response.json()) as {
    invitations?: WorkspaceInvitation[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load invitations.");
  }

  return body.invitations ?? [];
}

export async function acceptWorkspaceInvitation(
  invitationId: string
): Promise<{ workspace_user_id: string; message: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/workspace/invitations/${invitationId}/accept`,
    {
      method: "POST",
      headers,
    }
  );

  const body = (await response.json()) as {
    workspace_user_id?: string;
    message?: string;
    error?: string;
  };

  if (!response.ok || !body.workspace_user_id) {
    throw new Error(body.error || "Failed to accept invitation.");
  }

  return {
    workspace_user_id: body.workspace_user_id,
    message: body.message ?? "Invitation accepted.",
  };
}

export async function rejectWorkspaceInvitation(invitationId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/workspace/invitations/${invitationId}/reject`,
    {
      method: "POST",
      headers,
    }
  );

  const body = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Failed to reject invitation.");
  }
}
