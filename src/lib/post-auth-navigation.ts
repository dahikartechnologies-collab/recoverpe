import { getAuthHeaders } from "@/lib/auth-headers";
import {
  ActiveContext,
  IdentitySurfaces,
  merchantHomePath,
  resolveLandingPath,
  setActiveContextCookie,
} from "@/lib/active-context";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import { AppRole } from "@/types";

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

export async function resolvePostAuthPath(role: AppRole): Promise<string> {
  const { surfaces, active_context } = await fetchIdentitySurfaces();
  const path = resolveLandingPath({
    surfaces,
    role,
    activeContext: active_context,
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
