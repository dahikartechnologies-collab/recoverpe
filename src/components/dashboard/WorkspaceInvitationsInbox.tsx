"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatAppRoleLabel } from "@/lib/workspace-permissions";
import {
  acceptWorkspaceInvitation,
  fetchAccessibleWorkspaces,
  fetchWorkspaceInvitations,
  rejectWorkspaceInvitation,
} from "@/lib/workspace-client";
import { setWorkspaceCookies } from "@/lib/workspace-context";
import { WorkspaceInvitation } from "@/types";

interface WorkspaceInvitationsInboxProps {
  onInvitationChange?: () => void;
}

export function WorkspaceInvitationsInbox({
  onInvitationChange,
}: WorkspaceInvitationsInboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadInvitations = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const pending = await fetchWorkspaceInvitations();
      setInvitations(pending);
    } catch (loadError) {
      setInvitations([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load invitations."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  async function handleAccept(invitation: WorkspaceInvitation) {
    setRespondingId(invitation.id);
    setError("");

    try {
      const result = await acceptWorkspaceInvitation(invitation.id);
      const accessible = await fetchAccessibleWorkspaces();
      const target =
        accessible.options.find(
          (option) => option.workspace_user_id === result.workspace_user_id
        ) ?? accessible.options[0];

      if (target) {
        setWorkspaceCookies(target.workspace_user_id, target.business_id);
      }

      setInvitations((current) =>
        current.filter((entry) => entry.id !== invitation.id)
      );
      setIsOpen(false);
      onInvitationChange?.();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Failed to accept invitation."
      );
    } finally {
      setRespondingId(null);
    }
  }

  async function handleReject(invitation: WorkspaceInvitation) {
    setRespondingId(invitation.id);
    setError("");

    try {
      await rejectWorkspaceInvitation(invitation.id);
      setInvitations((current) =>
        current.filter((entry) => entry.id !== invitation.id)
      );
      onInvitationChange?.();
    } catch (rejectError) {
      setError(
        rejectError instanceof Error
          ? rejectError.message
          : "Failed to reject invitation."
      );
    } finally {
      setRespondingId(null);
    }
  }

  const pendingCount = invitations.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Workspace invitations"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="focus-ring relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-recoverpe-grey-light bg-recoverpe-white text-recoverpe-black transition-all duration-200 ease-out hover:bg-recoverpe-grey-light"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {pendingCount > 0 ? (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-recoverpe-error" />
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-recoverpe-grey-light bg-recoverpe-white shadow-sm transition-all duration-200 ease-out">
          <div className="border-b border-recoverpe-grey-light px-4 py-3">
            <p className="text-sm font-semibold text-recoverpe-black">Invitations</p>
            <p className="text-xs text-recoverpe-grey-medium">
              Accept to join a shared workspace.
            </p>
          </div>

          {error ? (
            <p className="px-4 py-3 text-sm text-recoverpe-error">{error}</p>
          ) : null}

          {isLoading ? (
            <p className="px-4 py-6 text-sm text-recoverpe-grey-medium">Loading...</p>
          ) : invitations.length === 0 ? (
            <EmptyState
              title="No pending invites"
              description="When a business invites you, it will appear here for review."
            />
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {invitations.map((invitation) => {
                const isResponding = respondingId === invitation.id;

                return (
                  <li
                    key={invitation.id}
                    className="border-b border-recoverpe-grey-light px-4 py-4 last:border-b-0"
                  >
                    <p className="text-sm text-recoverpe-black">
                      <span className="font-medium">{invitation.business_name}</span>{" "}
                      invited you as{" "}
                      <span className="font-medium">
                        {formatAppRoleLabel(invitation.role)}
                      </span>
                      .
                    </p>
                    {invitation.invitee_name ? (
                      <p className="mt-1 text-xs text-recoverpe-grey-medium">
                        Invited as {invitation.invitee_name}
                      </p>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        onClick={() => void handleAccept(invitation)}
                        disabled={Boolean(respondingId)}
                      >
                        {isResponding ? "Accepting..." : "Accept"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void handleReject(invitation)}
                        disabled={Boolean(respondingId)}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
