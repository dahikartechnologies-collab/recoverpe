import { NextResponse } from "next/server";
import {
  identityWriteBlockedResponse,
  requireActorIdentity,
} from "@/lib/identity-auth";
import {
  validateUserSettingsUpdate,
  UpdateUserSettingsPayload,
} from "@/lib/user-settings-validation";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

const USER_SETTINGS_SELECT =
  "id, email, phone_number, full_name, billing_address, alternate_phone, default_upi_vpa, account_status";

export async function PATCH(request: Request) {
  try {
    const identityResult = await requireActorIdentity(request);

    if ("error" in identityResult) {
      return identityResult.error;
    }

    const ghostBlocked = identityWriteBlockedResponse(identityResult);

    if (ghostBlocked) {
      return ghostBlocked;
    }

    const body = (await request.json()) as UpdateUserSettingsPayload;
    const validation = validateUserSettingsUpdate(body);

    if (validation.error || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from("users")
      .update(validation.data)
      .eq("id", identityResult.actorUserId)
      .select(USER_SETTINGS_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to update settings." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data,
      message: "Settings saved successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update settings.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
