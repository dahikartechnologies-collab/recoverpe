import { revalidatePath, revalidateTag } from "next/cache";

export const DASHBOARD_ANALYTICS_TAG = "dashboard-analytics";
export const WORKSPACE_ROLE_TAG = "workspace-role";

export function dashboardAnalyticsUserTag(userId: string): string {
  return `${DASHBOARD_ANALYTICS_TAG}:${userId}`;
}

export function workspaceRoleUserTag(actorUserId: string, workspaceUserId: string): string {
  return `${WORKSPACE_ROLE_TAG}:${actorUserId}:${workspaceUserId}`;
}

export function revalidateDashboardData(userId: string): void {
  revalidateTag(DASHBOARD_ANALYTICS_TAG);
  revalidateTag(dashboardAnalyticsUserTag(userId));
  revalidatePath("/dashboard");
}

export function revalidateWorkspaceRole(
  actorUserId: string,
  workspaceUserId: string
): void {
  revalidateTag(WORKSPACE_ROLE_TAG);
  revalidateTag(workspaceRoleUserTag(actorUserId, workspaceUserId));
}
