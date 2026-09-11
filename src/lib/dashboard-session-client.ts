import { getAuthHeaders } from "@/lib/auth-headers";
import { coalesceDashboardRequest } from "@/lib/dashboard-request-cache";
import { DashboardSessionPayload } from "@/lib/dashboard-session-types";
import { readApiJsonBody } from "@/lib/parse-api-response";
import {
  AccountPendingPurgeError,
  AccountSuspendedError,
} from "@/lib/users";
import { useWorkspaceStore } from "@/store/workspace-store";

const SESSION_CACHE_KEY = "dashboard-session";
const SESSION_TTL_MS = 20_000;

export type { DashboardSessionPayload };

export async function fetchDashboardSession(): Promise<DashboardSessionPayload> {
  return coalesceDashboardRequest(SESSION_CACHE_KEY, SESSION_TTL_MS, async () => {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/dashboard/session", { headers });
    const body = await readApiJsonBody<
      DashboardSessionPayload & {
        error?: string;
        code?: string;
      }
    >(response);

    if (response.status === 403 && body.code === "ACCOUNT_SUSPENDED") {
      throw new AccountSuspendedError(body.error);
    }

    if (response.status === 403 && body.code === "ACCOUNT_PENDING_PURGE") {
      throw new AccountPendingPurgeError(body.error);
    }

    if (!response.ok || !body.user) {
      throw new Error(body.error || "Failed to load dashboard session.");
    }

    if (body.ghost_mode?.active) {
      useWorkspaceStore.getState().setGhostMode(
        body.ghost_mode.impersonated_user_id,
        body.ghost_mode.impersonated_user_email
      );
    } else {
      useWorkspaceStore.getState().clearGhostMode();
    }

    return body;
  });
}
