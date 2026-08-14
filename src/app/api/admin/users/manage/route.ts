import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { executeAdminUserAction } from "@/lib/admin-users";
import { AdminManageUserPayload, AdminUserManageAction } from "@/types";

const VALID_ACTIONS = new Set<AdminUserManageAction>([
  "suspend",
  "unsuspend",
  "grant_discount",
]);

export async function POST(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const body = (await request.json()) as AdminManageUserPayload;

    if (!body.user_id?.trim()) {
      return NextResponse.json({ error: "user_id is required." }, { status: 400 });
    }

    if (!body.action || !VALID_ACTIONS.has(body.action)) {
      return NextResponse.json(
        { error: "action must be suspend, unsuspend, or grant_discount." },
        { status: 400 }
      );
    }

    const user = await executeAdminUserAction(
      authResult.userId,
      body.user_id.trim(),
      body.action
    );

    const messageByAction: Record<AdminUserManageAction, string> = {
      suspend: "User suspended and automations paused.",
      unsuspend: "User account reactivated.",
      grant_discount: "50% upsell discount eligibility granted.",
    };

    return NextResponse.json({
      success: true,
      user,
      message: messageByAction[body.action],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to manage user.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
