import { getAuthHeaders } from "@/lib/businesses";
import {
  AdminManageUserPayload,
  AdminManageUserResponse,
  AdminMetricsResponse,
  AdminUsersListResponse,
} from "@/types";

export async function fetchAdminMetrics(): Promise<AdminMetricsResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/admin/metrics", { headers });
  const body = (await response.json()) as AdminMetricsResponse & {
    error?: string;
  };

  if (response.status === 403) {
    throw new AdminAccessDeniedError(body.error || "Forbidden.");
  }

  if (!response.ok || !body.metrics) {
    throw new Error(body.error || "Failed to load admin metrics.");
  }

  return body;
}

export async function fetchAdminUsers(): Promise<AdminUsersListResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/admin/users", { headers });
  const body = (await response.json()) as AdminUsersListResponse & {
    error?: string;
  };

  if (response.status === 403) {
    throw new AdminAccessDeniedError(body.error || "Forbidden.");
  }

  if (!response.ok || !body.users) {
    throw new Error(body.error || "Failed to load admin users.");
  }

  return body;
}

export async function manageAdminUser(
  payload: AdminManageUserPayload
): Promise<AdminManageUserResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/admin/users/manage", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as AdminManageUserResponse & {
    error?: string;
  };

  if (response.status === 403) {
    throw new AdminAccessDeniedError(body.error || "Forbidden.");
  }

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to manage user.");
  }

  return body;
}

export class AdminAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAccessDeniedError";
  }
}
