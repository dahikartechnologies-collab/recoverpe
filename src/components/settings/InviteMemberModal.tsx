"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PermissionCheckboxGrid } from "@/components/settings/PermissionCheckboxGrid";
import {
  getDefaultPermissionsForRole,
  INVITABLE_WORKSPACE_ROLES,
  InvitableWorkspaceRole,
  formatAppRoleLabel,
} from "@/lib/workspace-permissions";
import { CustomPermissions } from "@/types";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (payload: {
    email: string;
    invitee_name: string;
    role: InvitableWorkspaceRole;
    custom_permissions: CustomPermissions;
  }) => Promise<void>;
}

export function InviteMemberModal({
  isOpen,
  onClose,
  onInvite,
}: InviteMemberModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableWorkspaceRole>("field_staff");
  const [permissions, setPermissions] = useState<CustomPermissions>(
    getDefaultPermissionsForRole("field_staff")
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPermissions(getDefaultPermissionsForRole(role));
  }, [role]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onInvite({
        email: email.trim(),
        invitee_name: name.trim(),
        role,
        custom_permissions: permissions,
      });
      setName("");
      setEmail("");
      setRole("field_staff");
      setPermissions(getDefaultPermissionsForRole("field_staff"));
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to invite team member."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite member"
      disableClose={isSubmitting}
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <label
            htmlFor="invite-name"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Name
          </label>
          <Input
            id="invite-name"
            type="text"
            placeholder="Teammate name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="invite-email"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Email address
          </label>
          <Input
            id="invite-email"
            type="email"
            placeholder="teammate@business.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="invite-role"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as InvitableWorkspaceRole)
            }
            className="w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2.5 text-sm text-recoverpe-black transition-all duration-200 ease-out"
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

        <p className="text-sm text-recoverpe-grey-medium">
          The user must already have a Recoverpe account with this email. They will
          receive a pending invitation to accept before joining your workspace.
        </p>

        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending invite..." : "Invite member"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
