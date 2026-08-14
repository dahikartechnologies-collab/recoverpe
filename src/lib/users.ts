import { getAuthHeaders } from "@/lib/auth-headers";
import { CurrentUserResponse, RecoverpeUser } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export async function fetchCurrentUser(): Promise<RecoverpeUser> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/users/me", { headers });
  const body = (await response.json()) as CurrentUserResponse & {
    error?: string;
  };

  if (!response.ok || !body.user) {
    throw new Error(body.error || "Failed to load user profile.");
  }

  if (body.ghost_mode?.active) {
    useWorkspaceStore.getState().setGhostMode(
      body.ghost_mode.impersonated_user_id,
      body.ghost_mode.impersonated_user_email
    );
  } else {
    useWorkspaceStore.getState().clearGhostMode();
  }

  return body.user;
}
