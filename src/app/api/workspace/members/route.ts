import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { withWorkspaceAuth } from "@/lib/auth-gateway";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { resolveWorkspaceAccess } from "@/lib/workspace-rbac";
import {
  assertNonOwnerRoleEscalationBlocked,
  getDefaultPermissionsForRole,
  INVITABLE_WORKSPACE_ROLES,
  parseCustomPermissions,
} from "@/lib/workspace-permissions";
import { InviteWorkspaceMemberPayload, WorkspaceMember } from "@/types";

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const access = await resolveWorkspaceAccess(
      contextResult.actorUserId,
      contextResult.effectiveUserId
    );

    if (contextResult.actorUserId !== contextResult.effectiveUserId) {
      return NextResponse.json(
        { error: "Partner access cannot view team members." },
        { status: 403 }
      );
    }

    if (!access.can_manage) {
      return NextResponse.json(
        { error: "You do not have permission to view team members." },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("workspace_members")
      .select(
        `
        id,
        role,
        status,
        invitee_name,
        custom_permissions,
        created_at,
        member_user_id,
        users:member_user_id (
          id,
          email,
          full_name,
          phone_number
        )
      `
      )
      .eq("workspace_user_id", access.workspace_user_id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load team members." },
        { status: 500 }
      );
    }

    const members: WorkspaceMember[] = (data ?? []).map((row) => {
      const user = Array.isArray(row.users) ? row.users[0] : row.users;

      return {
        id: row.id as string,
        role: row.role as WorkspaceMember["role"],
        created_at: row.created_at as string,
        member_user_id: row.member_user_id as string,
        email: (user?.email as string | undefined) ?? "",
        full_name: (user?.full_name as string | null | undefined) ?? null,
        phone_number: (user?.phone_number as string | undefined) ?? "",
        status: row.status as WorkspaceMember["status"],
        invitee_name: (row.invitee_name as string | null | undefined) ?? null,
        custom_permissions: parseCustomPermissions(row.custom_permissions),
      };
    });

    return NextResponse.json({ members });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load team members.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withWorkspaceAuth(async (request, auth) => {
    const body = (await request.json()) as InviteWorkspaceMemberPayload;
    const email = body.email?.trim().toLowerCase();
    const inviteeName = body.invitee_name?.trim();
    const role = body.role;

    try {
      assertNonOwnerRoleEscalationBlocked(auth.isOwner, role);
    } catch (escalationError) {
      return NextResponse.json(
        {
          error:
            escalationError instanceof Error
              ? escalationError.message
              : "Forbidden.",
        },
        { status: 403 }
      );
    }
    const customPermissions =
      body.custom_permissions ?? getDefaultPermissionsForRole(role);

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!inviteeName) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    if (!INVITABLE_WORKSPACE_ROLES.includes(role as (typeof INVITABLE_WORKSPACE_ROLES)[number])) {
      return NextResponse.json(
        {
          error:
            "Role must be admin, recovery_agent, accountant, or field_staff.",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: invitedUser, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    if (userError) {
      return NextResponse.json(
        { error: userError.message || "Failed to look up user." },
        { status: 500 }
      );
    }

    if (!invitedUser) {
      return NextResponse.json(
        {
          error:
            "No Recoverpe account exists for this email yet. Ask them to register first, then invite again.",
        },
        { status: 404 }
      );
    }

    if (invitedUser.id === auth.workspaceUserId) {
      return NextResponse.json(
        { error: "The workspace owner cannot be added as a team member." },
        { status: 400 }
      );
    }

    const { data: existingMembership } = await supabase
      .from("workspace_members")
      .select("id, status")
      .eq("workspace_user_id", auth.workspaceUserId)
      .eq("member_user_id", invitedUser.id)
      .maybeSingle();

    if (existingMembership?.status === "accepted") {
      return NextResponse.json(
        { error: "This user is already a member of your workspace." },
        { status: 409 }
      );
    }

    if (existingMembership?.status === "pending") {
      return NextResponse.json(
        { error: "This user already has a pending invitation." },
        { status: 409 }
      );
    }

    if (existingMembership?.status === "rejected") {
      const { data: updated, error: updateError } = await supabase
        .from("workspace_members")
        .update({
          role,
          invitee_name: inviteeName,
          status: "pending",
          invited_by_user_id: auth.actorUserId,
          custom_permissions: customPermissions,
        })
        .eq("id", existingMembership.id)
        .select("id, role, status, invitee_name, created_at, member_user_id, custom_permissions")
        .single();

      if (updateError || !updated) {
        return NextResponse.json(
          { error: updateError?.message || "Failed to re-send invitation." },
          { status: 500 }
        );
      }

      const member: WorkspaceMember = {
        id: updated.id as string,
        role: updated.role as WorkspaceMember["role"],
        created_at: updated.created_at as string,
        member_user_id: updated.member_user_id as string,
        email: invitedUser.email as string,
        full_name: null,
        phone_number: "",
        status: updated.status as WorkspaceMember["status"],
        invitee_name: updated.invitee_name as string,
        custom_permissions: parseCustomPermissions(updated.custom_permissions),
      };

      return NextResponse.json(
        {
          member,
          message: "Invitation sent successfully.",
        },
        { status: 201 }
      );
    }

    const { data, error } = await supabase
      .from("workspace_members")
      .insert({
        workspace_user_id: auth.workspaceUserId,
        member_user_id: invitedUser.id,
        role,
        invitee_name: inviteeName,
        status: "pending",
        invited_by_user_id: auth.actorUserId,
        custom_permissions: customPermissions,
      })
      .select("id, role, status, invitee_name, created_at, member_user_id, custom_permissions")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to invite team member." },
        { status: 500 }
      );
    }

    const member: WorkspaceMember = {
      id: data.id as string,
      role: data.role as WorkspaceMember["role"],
      created_at: data.created_at as string,
      member_user_id: data.member_user_id as string,
      email: invitedUser.email as string,
      full_name: null,
      phone_number: "",
      status: data.status as WorkspaceMember["status"],
      invitee_name: data.invitee_name as string,
      custom_permissions: parseCustomPermissions(data.custom_permissions),
    };

    return NextResponse.json(
      {
        member,
        message: "Invitation sent successfully.",
      },
      { status: 201 }
    );
}, { ownerOnly: true });
