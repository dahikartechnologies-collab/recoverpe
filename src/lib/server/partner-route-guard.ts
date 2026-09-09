import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ACTOR_USER_COOKIE, WORKSPACE_USER_COOKIE } from "@/lib/cookie-constants";
import { isPartnerContextFromCookies } from "@/lib/partner-context";
import { resolveWorkspaceRouteAccess } from "@/lib/server/workspace-route-access";

export async function enforceDashboardHomeRoute(): Promise<void> {
  const { canAccessDashboardHome } = await resolveWorkspaceRouteAccess();

  if (!canAccessDashboardHome) {
    redirect("/dashboard/vendors");
  }
}

export async function enforceSettingsRoute(): Promise<void> {
  const { canAccessSettings } = await resolveWorkspaceRouteAccess();

  if (!canAccessSettings) {
    redirect("/dashboard/vendors");
  }
}

export function enforceOwnerWorkspaceRoute(): void {
  const cookieStore = cookies();
  const actorUserId = cookieStore.get(ACTOR_USER_COOKIE)?.value ?? null;
  const workspaceUserId = cookieStore.get(WORKSPACE_USER_COOKIE)?.value ?? null;

  if (isPartnerContextFromCookies(actorUserId, workspaceUserId)) {
    redirect("/dashboard/vendors");
  }
}
