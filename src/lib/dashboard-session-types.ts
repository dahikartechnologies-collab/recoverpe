import {
  AccessibleBusinessOption,
  Business,
  CurrentUserResponse,
  RecoverpeUser,
  WorkspaceRoleContext,
} from "@/types";

export interface DashboardSessionPayload {
  user: RecoverpeUser;
  ghost_mode: CurrentUserResponse["ghost_mode"];
  role: WorkspaceRoleContext;
  accessible_workspaces: AccessibleBusinessOption[];
  unique_workspace_count: number;
  businesses: Business[];
}
