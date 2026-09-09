"use client";

import {
  getDefaultPermissionsForRole,
  InvitableWorkspaceRole,
  PERMISSION_DEFINITIONS,
} from "@/lib/workspace-permissions";
import { CustomPermissions } from "@/types";

interface PermissionCheckboxGridProps {
  role: InvitableWorkspaceRole;
  permissions: CustomPermissions;
  onChange: (permissions: CustomPermissions) => void;
  disabled?: boolean;
}

export function PermissionCheckboxGrid({
  role,
  permissions,
  onChange,
  disabled = false,
}: PermissionCheckboxGridProps) {
  function handleRoleChange(nextRole: InvitableWorkspaceRole) {
    onChange(getDefaultPermissionsForRole(nextRole));
  }

  function togglePermission(key: keyof CustomPermissions) {
    onChange({
      ...permissions,
      [key]: !permissions[key],
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="type-eyebrow">Granular permissions</p>
        <p className="type-data-secondary mt-1 text-xs">
          Defaults follow the selected role. Override any checkbox before saving.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PERMISSION_DEFINITIONS.map((definition) => (
          <label
            key={definition.key}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-recoverpe-grey-light px-3 py-3 transition-colors hover:bg-recoverpe-grey-light/40"
          >
            <input
              type="checkbox"
              checked={permissions[definition.key]}
              disabled={disabled}
              onChange={() => togglePermission(definition.key)}
              className="focus-ring mt-0.5 h-4 w-4 rounded border-recoverpe-grey-light text-recoverpe-black"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-recoverpe-black">
                {definition.label}
              </span>
              <span className="mt-0.5 block text-xs text-recoverpe-grey-medium">
                {definition.description}
              </span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => handleRoleChange(role)}
        className="text-xs font-medium text-recoverpe-black underline underline-offset-2 disabled:opacity-50"
      >
        Reset to {role.replace("_", " ")} defaults
      </button>
    </div>
  );
}
