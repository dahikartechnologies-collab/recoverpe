import { getAuthHeaders } from "@/lib/auth-headers";
import { CurrentUserResponse, RecoverpeUser } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export class AccountSuspendedError extends Error {
  constructor(message = "Account suspended by administrator") {
    super(message);
    this.name = "AccountSuspendedError";
  }
}

export class AccountPendingPurgeError extends Error {
  constructor(message = "Account scheduled for deletion per DPDP compliance.") {
    super(message);
    this.name = "AccountPendingPurgeError";
  }
}

export async function fetchCurrentUser(): Promise<RecoverpeUser> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/users/me", { headers });
  const body = (await response.json()) as CurrentUserResponse & {
    error?: string;
    code?: string;
  };

  if (
    response.status === 403 &&
    body.code === "ACCOUNT_SUSPENDED"
  ) {
    throw new AccountSuspendedError(body.error);
  }

  if (
    response.status === 403 &&
    body.code === "ACCOUNT_PENDING_PURGE"
  ) {
    throw new AccountPendingPurgeError(body.error);
  }

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
