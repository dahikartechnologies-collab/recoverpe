import { NextResponse } from "next/server";
import {
  ghostModeWriteBlockedResponse,
  resolveEffectiveUserContext,
} from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { resolveWorkspaceAccess } from "@/lib/workspace-rbac";
import {
  assertNonOwnerRoleEscalationBlocked,
  getDefaultPermissionsForRole,
  INVITABLE_WORKSPACE_ROLES,
  parseCustomPermissions,
} from "@/lib/workspace-permissions";
import { CustomPermissions, WorkspaceMember } from "@/types";

interface RouteContext {
  params: { id: string };
}

async function getMemberForOwner(
  memberId: string,
  workspaceUserId: string
): Promise<WorkspaceMember | null> {
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
    .eq("id", memberId)
    .eq("workspace_user_id", workspaceUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const user = Array.isArray(data.users) ? data.users[0] : data.users;

  return {
    id: data.id as string,
    role: data.role as WorkspaceMember["role"],
    created_at: data.created_at as string,
    member_user_id: data.member_user_id as string,
    email: (user?.email as string | undefined) ?? "",
    full_name: (user?.full_name as string | null | undefined) ?? null,
    phone_number: (user?.phone_number as string | undefined) ?? "",
    status: data.status as WorkspaceMember["status"],
    invitee_name: (data.invitee_name as string | null | undefined) ?? null,
    custom_permissions: parseCustomPermissions(data.custom_permissions),
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const ghostBlocked = ghostModeWriteBlockedResponse(contextResult);

    if (ghostBlocked) {
      return ghostBlocked;
    }

    const access = await resolveWorkspaceAccess(
      contextResult.actorUserId,
      contextResult.effectiveUserId
    );

    if (contextResult.actorUserId !== contextResult.effectiveUserId) {
      return NextResponse.json(
        {
          error:
            "Partner access cannot modify team members. Switch to My Account.",
        },
        { status: 403 }
      );
    }

    if (!access.can_manage) {
      return NextResponse.json(
        { error: "You do not have permission to edit team members." },
        { status: 403 }
      );
    }

    const memberId = context.params.id?.trim();

    if (!memberId) {
      return NextResponse.json({ error: "Member id is required." }, { status: 400 });
    }

    const body = (await request.json()) as {
      role?: WorkspaceMember["role"];
      custom_permissions?: CustomPermissions;
    };
    const role = body.role;
    const customPermissions =
      body.custom_permissions ??
      (role ? getDefaultPermissionsForRole(role) : undefined);

    if (
      !role ||
      !INVITABLE_WORKSPACE_ROLES.includes(
        role as (typeof INVITABLE_WORKSPACE_ROLES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Role must be admin, recovery_agent, accountant, or field_staff.",
        },
        { status: 400 }
      );
    }

    try {
      assertNonOwnerRoleEscalationBlocked(access.is_owner, role);
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

    if (!customPermissions) {
      return NextResponse.json(
        { error: "Custom permissions are required." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("id, member_user_id, role")
      .eq("id", memberId)
      .eq("workspace_user_id", access.workspace_user_id)
      .maybeSingle();

    if (!existingMember) {
      return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    }

    if (!access.is_owner && existingMember.role === "admin") {
      return NextResponse.json(
        { error: "Only the workspace owner can modify admin members." },
        { status: 403 }
      );
    }

    if (existingMember.member_user_id === contextResult.actorUserId) {
      return NextResponse.json(
        { error: "You cannot change your own workspace membership." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("workspace_members")
      .update({
        role,
        custom_permissions: customPermissions,
      })
      .eq("id", memberId)
      .eq("workspace_user_id", access.workspace_user_id);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update team member." },
        { status: 500 }
      );
    }

    const member = await getMemberForOwner(memberId, access.workspace_user_id);

    if (!member) {
      return NextResponse.json(
        { error: "Team member updated but refresh failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({ member, message: "Team member updated." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update team member.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const contextResult = await resolveEffectiveUserContext(_request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const ghostBlocked = ghostModeWriteBlockedResponse(contextResult);

    if (ghostBlocked) {
      return ghostBlocked;
    }

    const access = await resolveWorkspaceAccess(
      contextResult.actorUserId,
      contextResult.effectiveUserId
    );

    if (!access.is_owner) {
      return NextResponse.json(
        { error: "Only the workspace owner can remove team members." },
        { status: 403 }
      );
    }

    const memberId = context.params.id?.trim();

    if (!memberId) {
      return NextResponse.json({ error: "Member id is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("id, member_user_id")
      .eq("id", memberId)
      .eq("workspace_user_id", access.workspace_user_id)
      .maybeSingle();

    if (!existingMember) {
      return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    }

    if (existingMember.member_user_id === contextResult.actorUserId) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the workspace." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", memberId)
      .eq("workspace_user_id", access.workspace_user_id);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to remove team member." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Team member removed.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove team member.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
