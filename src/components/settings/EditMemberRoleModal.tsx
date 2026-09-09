"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PermissionCheckboxGrid } from "@/components/settings/PermissionCheckboxGrid";
import {
  getDefaultPermissionsForRole,
  INVITABLE_WORKSPACE_ROLES,
  InvitableWorkspaceRole,
  formatAppRoleLabel,
} from "@/lib/workspace-permissions";
import { CustomPermissions, WorkspaceMember } from "@/types";

interface EditMemberRoleModalProps {
  member: WorkspaceMember | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    memberId: string,
    role: InvitableWorkspaceRole,
    custom_permissions: CustomPermissions
  ) => Promise<void>;
}

export function EditMemberRoleModal({
  member,
  isOpen,
  onClose,
  onSave,
}: EditMemberRoleModalProps) {
  const [role, setRole] = useState<InvitableWorkspaceRole>("field_staff");
  const [permissions, setPermissions] = useState<CustomPermissions>(
    getDefaultPermissionsForRole("field_staff")
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (member) {
      setRole(member.role);
      setPermissions(member.custom_permissions);
      setError("");
    }
  }, [member]);

  useEffect(() => {
    if (member && member.role === role) {
      return;
    }

    setPermissions(getDefaultPermissionsForRole(role));
  }, [role, member]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!member) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onSave(member.id, role, permissions);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to update team member."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit member role"
      disableClose={isSubmitting}
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <p className="text-sm font-medium text-recoverpe-black">
            {member?.full_name || member?.email}
          </p>
          <p className="text-sm text-recoverpe-grey-medium">{member?.email}</p>
        </div>

        <div>
          <label
            htmlFor="edit-member-role"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Role
          </label>
          <select
            id="edit-member-role"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as InvitableWorkspaceRole)
            }
            className="w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2.5 text-sm text-recoverpe-black"
          >
            {INVITABLE_WORKSPACE_ROLES.map((option) => (
              <option key={option} value={option}>
                {formatAppRoleLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <PermissionCheckboxGrid
          role={role}
          permissions={permissions}
          onChange={setPermissions}
          disabled={isSubmitting}
        />

        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
