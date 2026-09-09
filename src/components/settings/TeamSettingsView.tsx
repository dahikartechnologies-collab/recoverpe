"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EditMemberRoleModal } from "@/components/settings/EditMemberRoleModal";
import { InviteMemberModal } from "@/components/settings/InviteMemberModal";
import { TeamMemberActionsMenu } from "@/components/settings/TeamMemberActionsMenu";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { fetchWorkspaceRole } from "@/lib/kiosk-client";
import {
  canAccessTeamSettings,
  formatAppRoleLabel,
  InvitableWorkspaceRole,
} from "@/lib/workspace-permissions";
import { CustomPermissions } from "@/types";
import {
  fetchWorkspaceMembers,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMember,
} from "@/lib/workspace-client";
import { WorkspaceMember } from "@/types";

export function TeamSettingsView() {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [removingMember, setRemovingMember] = useState<WorkspaceMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const loadTeam = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const roleContext = await fetchWorkspaceRole();

      if (!canAccessTeamSettings(roleContext.role, roleContext.custom_permissions)) {
        setCanManageTeam(false);
        setIsOwner(false);
        setMembers([]);
        setError("Your role does not have access to team settings.");
        return;
      }

      setCanManageTeam(true);
      setIsOwner(roleContext.role === "owner");

      const teamMembers = await fetchWorkspaceMembers();
      setMembers(teamMembers);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load team members."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  async function handleInvite(payload: {
    email: string;
    invitee_name: string;
    role: InvitableWorkspaceRole;
    custom_permissions: CustomPermissions;
  }) {
    const member = await inviteWorkspaceMember(payload);
    setMembers((current) => [...current, member]);
    setSuccessMessage("Invitation sent successfully.");
  }

  async function handleSaveRole(
    memberId: string,
    role: InvitableWorkspaceRole,
    custom_permissions: CustomPermissions
  ) {
    const updatedMember = await updateWorkspaceMember(memberId, role, custom_permissions);
    setMembers((current) =>
      current.map((member) => (member.id === memberId ? updatedMember : member))
    );
    setSuccessMessage("Team member role updated.");
  }

  async function handleConfirmRemove() {
    if (!removingMember) {
      return;
    }

    setIsRemoving(true);
    setError("");

    try {
      await removeWorkspaceMember(removingMember.id);
      setMembers((current) =>
        current.filter((member) => member.id !== removingMember.id)
      );
      setRemovingMember(null);
      setSuccessMessage("Team member removed.");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove team member."
      );
    } finally {
      setIsRemoving(false);
    }
  }

  if (!canManageTeam && !isLoading && error) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <p className="text-sm text-recoverpe-error">{error}</p>
          <Link
            href="/dashboard/settings"
            className="text-sm font-medium text-recoverpe-black underline"
          >
            Back to settings
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-page-title">Team</h1>
          <p className="type-data-secondary mt-3 text-sm leading-relaxed">
            Manage admins, recovery agents, accountants, and field staff.
          </p>
        </div>
        {isOwner ? (
          <Button type="button" onClick={() => setIsInviteOpen(true)}>
            Invite Member
          </Button>
        ) : null}
      </div>

      {successMessage ? (
        <p className="text-sm text-recoverpe-success">{successMessage}</p>
      ) : null}

      {error && canManageTeam ? (
        <p className="text-sm text-recoverpe-error">{error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold tracking-tight text-recoverpe-black">
            Workspace members
          </h2>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-recoverpe-grey-medium">Loading team...</p>
          ) : members.length === 0 ? (
            <EmptyState
              title="No team members yet"
              description="Invite admins, recovery agents, accountants, or field staff to collaborate in this workspace."
              action={
                isOwner ? (
                  <Button type="button" onClick={() => setIsInviteOpen(true)}>
                    Invite Member
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="md:hidden flex flex-col space-y-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-md border border-recoverpe-grey-light p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-recoverpe-black">
                          {member.invitee_name || member.full_name || "—"}
                        </p>
                        <p className="type-data-secondary mt-1 truncate text-xs">
                          {member.email}
                        </p>
                      </div>
                      {isOwner ? (
                        <TeamMemberActionsMenu
                          member={member}
                          onEdit={setEditingMember}
                          onRemove={setRemovingMember}
                        />
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-recoverpe-grey-light bg-recoverpe-grey-light/40 px-2 py-0.5 text-xs font-medium text-recoverpe-black">
                        {formatAppRoleLabel(member.role)}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${
                          member.status === "accepted"
                            ? "border-recoverpe-success/30 text-recoverpe-success"
                            : member.status === "pending"
                              ? "border-recoverpe-grey-light text-recoverpe-grey-medium"
                              : "border-recoverpe-error/30 text-recoverpe-error"
                        }`}
                      >
                        {member.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-recoverpe-grey-light">
                  <th className="type-table-header px-3 py-4">Name</th>
                  <th className="type-table-header px-3 py-4">Email</th>
                  <th className="type-table-header px-3 py-4">Role</th>
                  <th className="type-table-header px-3 py-4">Status</th>
                  {isOwner ? (
                    <th className="type-table-header px-3 py-4 text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="group border-b border-recoverpe-grey-light transition-all duration-200 ease-out last:border-b-0 hover:bg-recoverpe-grey-light/40"
                  >
                    <td className="px-3 py-4 text-sm font-semibold text-recoverpe-black">
                      {member.invitee_name || member.full_name || "—"}
                    </td>
                    <td className="type-data-secondary px-3 py-4 text-sm">
                      {member.email}
                    </td>
                    <td className="px-3 py-4 text-sm text-recoverpe-black">
                      {formatAppRoleLabel(member.role)}
                    </td>
                    <td className="px-3 py-4 text-recoverpe-black">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${
                          member.status === "accepted"
                            ? "border-recoverpe-success/30 text-recoverpe-success"
                            : member.status === "pending"
                              ? "border-recoverpe-grey-light text-recoverpe-grey-medium"
                              : "border-recoverpe-error/30 text-recoverpe-error"
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    {isOwner ? (
                      <td className="px-3 py-4 text-right opacity-100 transition-opacity duration-200 ease-out md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                        <TeamMemberActionsMenu
                          member={member}
                          onEdit={setEditingMember}
                          onRemove={setRemovingMember}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInvite={handleInvite}
      />

      <EditMemberRoleModal
        member={editingMember}
        isOpen={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        onSave={handleSaveRole}
      />

      <Modal
        isOpen={Boolean(removingMember)}
        onClose={() => {
          if (!isRemoving) {
            setRemovingMember(null);
          }
        }}
        title="Remove team member"
        disableClose={isRemoving}
      >
        <div className="space-y-4">
          <p className="text-sm text-recoverpe-grey-medium">
            Remove{" "}
            <span className="font-medium text-recoverpe-black">
              {removingMember?.full_name || removingMember?.email}
            </span>{" "}
            from this workspace? They will lose access immediately.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRemovingMember(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmRemove()}
              disabled={isRemoving}
            >
              {isRemoving ? "Removing..." : "Remove user"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
