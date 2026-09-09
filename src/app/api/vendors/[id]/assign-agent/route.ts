import { NextResponse } from "next/server";
import {
  ghostModeWriteBlockedResponse,
  resolveEffectiveUserContext,
} from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { resolveWorkspaceAccess } from "@/lib/workspace-rbac";

interface RouteContext {
  params: { id: string };
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

    if (!access.can_manage && !access.custom_permissions.edit_ledgers) {
      return NextResponse.json(
        { error: "You do not have permission to assign collection agents." },
        { status: 403 }
      );
    }

    const contactId = context.params.id?.trim();

    if (!contactId) {
      return NextResponse.json({ error: "Vendor id is required." }, { status: 400 });
    }

    const body = (await request.json()) as {
      assigned_to_user_id?: string | null;
      business_id?: string | null;
    };

    if (body.assigned_to_user_id !== null && body.assigned_to_user_id !== undefined) {
      const assignedUserId = body.assigned_to_user_id.trim();

      if (!assignedUserId) {
        return NextResponse.json(
          { error: "assigned_to_user_id cannot be empty." },
          { status: 400 }
        );
      }

      const supabase = createAdminSupabaseClient();
      const { data: fieldStaffMember } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_user_id", access.workspace_user_id)
        .eq("member_user_id", assignedUserId)
        .eq("role", "field_staff")
        .eq("status", "accepted")
        .maybeSingle();

      if (!fieldStaffMember) {
        return NextResponse.json(
          {
            error:
              "Selected agent must be an accepted field staff member who has joined your workspace.",
          },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminSupabaseClient();

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("user_id", access.workspace_user_id)
      .maybeSingle();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    }

    let ledgerQuery = supabase
      .from("ledgers")
      .update({
        assigned_to_user_id: body.assigned_to_user_id ?? null,
      })
      .eq("contact_id", contactId)
      .eq("user_id", access.workspace_user_id)
      .gt("balance_due", 0);

    if (body.business_id) {
      ledgerQuery = ledgerQuery.eq("business_id", body.business_id);
    }

    const { data: updatedLedgers, error: updateError } = await ledgerQuery.select("id");

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to assign collection agent." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated_ledger_count: updatedLedgers?.length ?? 0,
      assigned_to_user_id: body.assigned_to_user_id ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to assign collection agent.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
