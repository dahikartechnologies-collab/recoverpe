import { getAuthHeaders } from "@/lib/auth-headers";
import {
  AppRole,
  KioskAssignmentsResponse,
  WorkspaceRoleContext,
} from "@/types";
import {
  clearAppRoleCookie,
  getAppRoleFromDocument,
  setAppRoleCookie,
} from "@/lib/auth-cookies";

export { setAppRoleCookie, clearAppRoleCookie, getAppRoleFromDocument };

export async function fetchWorkspaceRole(): Promise<WorkspaceRoleContext> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/users/workspace-role", { headers });
  const body = (await response.json()) as WorkspaceRoleContext & { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Failed to resolve workspace role.");
  }

  return body;
}

export async function fetchKioskAssignments(): Promise<KioskAssignmentsResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/kiosk/assignments", { headers });
  const body = (await response.json()) as KioskAssignmentsResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load kiosk assignments.");
  }

  return body;
}

export function getPostLoginRoute(role: AppRole): "/dashboard" | "/kiosk" {
  return role === "field_staff" ? "/kiosk" : "/dashboard";
}
