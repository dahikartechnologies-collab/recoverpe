import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  validatePlatformSettingsPatch,
  type PlatformSettingsPatch,
} from "@/lib/platform-settings";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const supabase = createAdminSupabaseClient();
    const settings = await fetchPlatformSettings(supabase);

    return NextResponse.json({ settings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load platform settings.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const body = (await request.json()) as PlatformSettingsPatch;
    const validationError = validatePlatformSettingsPatch(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const settings = await updatePlatformSettings(supabase, body);

    return NextResponse.json({ settings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update platform settings.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
