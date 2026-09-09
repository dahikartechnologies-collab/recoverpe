import {
  AppRole,
  CustomPermissions,
  DEFAULT_CUSTOM_PERMISSIONS,
  OWNER_CUSTOM_PERMISSIONS,
} from "@/types";

export function isAccountantRole(role: AppRole | null | undefined): boolean {
  return role === "accountant";
}

export function isFieldStaffRole(role: AppRole | null | undefined): boolean {
  return role === "field_staff";
}

export function getDefaultPermissionsForRole(
  role: Exclude<AppRole, "owner">
): CustomPermissions {
  switch (role) {
    case "admin":
      return {
        manage_team: true,
        edit_settings: true,
        edit_ledgers: true,
        send_reminders: true,
        export_data: true,
        spend_funds: true,
      };
    case "recovery_agent":
      return {
        manage_team: false,
        edit_settings: false,
        edit_ledgers: false,
        send_reminders: true,
        export_data: false,
        spend_funds: false,
      };
    case "accountant":
      return {
        manage_team: false,
        edit_settings: false,
        edit_ledgers: false,
        send_reminders: false,
        export_data: true,
        spend_funds: false,
      };
    case "field_staff":
    default:
      return { ...DEFAULT_CUSTOM_PERMISSIONS };
  }
}

export function parseCustomPermissions(value: unknown): CustomPermissions {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_CUSTOM_PERMISSIONS };
  }

  const record = value as Record<string, unknown>;

  return {
    manage_team: record.manage_team === true,
    edit_settings: record.edit_settings === true,
    edit_ledgers: record.edit_ledgers === true,
    send_reminders: record.send_reminders === true,
    export_data: record.export_data === true,
    spend_funds: record.spend_funds === true,
  };
}

export function resolveEffectivePermissions(
  role: AppRole | null | undefined,
  customPermissions?: CustomPermissions | null
): CustomPermissions {
  if (!role || role === "owner") {
    return { ...OWNER_CUSTOM_PERMISSIONS };
  }

  if (customPermissions) {
    return { ...customPermissions };
  }

  return getDefaultPermissionsForRole(role);
}

export function hasPermission(
  permissions: CustomPermissions | null | undefined,
  key: keyof CustomPermissions
): boolean {
  if (!permissions) {
    return false;
  }

  return permissions[key] === true;
}

/** Owner bypasses JSONB; all other roles are evaluated only from stored custom_permissions. */
export function hasWorkspacePermission(
  role: AppRole | null | undefined,
  permissions: CustomPermissions | null | undefined,
  key: keyof CustomPermissions
): boolean {
  if (role === "owner") {
    return true;
  }

  return hasPermission(permissions, key);
}

export function canAccessTeamSettings(
  role: AppRole | null | undefined,
  permissions?: CustomPermissions | null
): boolean {
  return hasWorkspacePermission(role, permissions, "manage_team");
}

export function canEditBusinessSettings(
  role: AppRole | null | undefined,
  permissions?: CustomPermissions | null
): boolean {
  return hasWorkspacePermission(role, permissions, "edit_settings");
}

export function canAccessAccountSettings(isOwnWorkspaceContext: boolean): boolean {
  return isOwnWorkspaceContext;
}

export function canMutateLedgers(
  role: AppRole | null | undefined,
  permissions?: CustomPermissions | null
): boolean {
  return hasWorkspacePermission(role, permissions, "edit_ledgers");
}

export function canViewEvidenceDocket(
  role: AppRole | null | undefined,
  permissions?: CustomPermissions | null
): boolean {
  return (
    hasWorkspacePermission(role, permissions, "edit_ledgers") ||
    hasWorkspacePermission(role, permissions, "manage_team")
  );
}

export function canSendReminders(
  role: AppRole | null | undefined,
  permissions?: CustomPermissions | null
): boolean {
  return hasWorkspacePermission(role, permissions, "send_reminders");
}

export function canSpendFunds(
  role: AppRole | null | undefined,
  permissions?: CustomPermissions | null
): boolean {
  return hasWorkspacePermission(role, permissions, "spend_funds");
}

export function canExportData(
  role: AppRole | null | undefined,
  permissions?: CustomPermissions | null
): boolean {
  return hasWorkspacePermission(role, permissions, "export_data");
}

export function formatAppRoleLabel(role: AppRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "recovery_agent":
      return "Recovery Agent";
    case "accountant":
      return "Accountant";
    case "field_staff":
      return "Field Staff";
    default:
      return role;
  }
}

export const PERMISSION_DEFINITIONS: Array<{
  key: keyof CustomPermissions;
  label: string;
  description: string;
}> = [
  {
    key: "manage_team",
    label: "Manage team",
    description: "Invite, edit, and remove workspace members.",
  },
  {
    key: "edit_settings",
    label: "Edit business profile",
    description: "Update business name, address, and GSTIN.",
  },
  {
    key: "edit_ledgers",
    label: "Edit ledgers",
    description: "Create, rectify, and assign collection routes.",
  },
  {
    key: "send_reminders",
    label: "Send reminders",
    description: "Send free WhatsApp and email reminder pings.",
  },
  {
    key: "export_data",
    label: "Export data",
    description: "Download CSV exports and ledger documents.",
  },
  {
    key: "spend_funds",
    label: "Spend funds",
    description: "Initiate paid Razorpay transactions (legal notices, Samadhaan kits).",
  },
];

export function assertNonOwnerRoleEscalationBlocked(
  isOwner: boolean,
  role: string
): void {
  if (!isOwner && role === "admin") {
    throw new Error("Only the workspace owner can assign the admin role.");
  }
}

export const DELEGATED_INVITABLE_ROLES = [
  "recovery_agent",
  "accountant",
  "field_staff",
] as const;

export const INVITABLE_WORKSPACE_ROLES = [
  "admin",
  "recovery_agent",
  "accountant",
  "field_staff",
] as const;

export type InvitableWorkspaceRole = (typeof INVITABLE_WORKSPACE_ROLES)[number];
