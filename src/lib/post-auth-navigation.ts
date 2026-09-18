import { getAuthHeaders } from "@/lib/auth-headers";
import {
  ActiveContext,
  getActiveContextFromDocument,
  IdentitySurfaces,
  merchantHomePath,
  reconcileStaleActiveContext,
  resolveLandingPath,
  setActiveContextCookie,
} from "@/lib/active-context";
import { setAppRoleCookie } from "@/lib/auth-cookies";
import { fetchWorkspaceRole } from "@/lib/kiosk-client";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import { clearWorkspaceCookies } from "@/lib/workspace-context";

export function isAgentContextActive(): boolean {
  return getActiveContextFromDocument() === "agent";
}

export async function fetchIdentitySurfaces(): Promise<{
  surfaces: IdentitySurfaces;
  active_context: ActiveContext | null;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/session/surfaces", { headers });
  return parseApiJsonResponse(response);
}

export async function persistActiveContext(context: ActiveContext): Promise<void> {
  setActiveContextCookie(context);
  const headers = await getAuthHeaders();
  const response = await fetch("/api/session/context", {
    method: "POST",
    headers,
    body: JSON.stringify({ context }),
  });
  await parseApiJsonResponse(response);
}

/**
 * Resolves the first screen after auth. Clears stale agent cookies before merchant
 * hydration, then skips workspace-role when the user is genuinely in agent context.
 */
export async function resolvePostAuthPath(): Promise<string> {
  clearWorkspaceCookies();

  const { surfaces, active_context } = await fetchIdentitySurfaces();
  const activeContext = reconcileStaleActiveContext(surfaces, active_context);

  if (activeContext !== active_context && activeContext === "merchant") {
    await persistActiveContext("merchant");
  }

  if (activeContext === "agent" && surfaces.has_agent) {
    await persistActiveContext("agent");
    return "/agent-dashboard";
  }

  const roleContext = await fetchWorkspaceRole();
  setAppRoleCookie(roleContext.role);

  const path = resolveLandingPath({
    surfaces,
    role: roleContext.role,
    activeContext,
    preferChooserWhenBoth: true,
  });

  if (path === "/agent-dashboard") {
    await persistActiveContext("agent");
  } else if (path === "/dashboard" || path === "/kiosk") {
    await persistActiveContext("merchant");
  }

  return path;
}

export { merchantHomePath };
