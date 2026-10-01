import { NextResponse } from "next/server";
import { withWorkspaceAuth, withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  AutomationSettingsResponse,
  parseAutomationSettings,
  parseAutomationSettingsPatch,
} from "@/lib/automation-settings";
import { isMissingAutomationColumn } from "@/lib/automation-settings-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { BusinessAutomationSettings } from "@/types";

export const dynamic = "force-dynamic";

const SCOPE = "businesses/automation";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: { id: string };
}

function jsonError(message: string, status: number, code?: string) {
  const log = status >= 500 ? console.error : console.warn;
  log(`[${SCOPE}] ${status}: ${message}`);

  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

function migrationRequired() {
  return jsonError(
    "Automation settings are not available yet. Run migration 065 in Supabase.",
    503,
    "MIGRATION_REQUIRED"
  );
}

async function loadOwnedSettings(businessId: string, workspaceUserId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, automation_settings")
    .eq("id", businessId)
    .eq("user_id", workspaceUserId)
    .maybeSingle();

  return { supabase, data, error };
}

export const GET = withWorkspaceAuth<RouteContext>(
  async (_request, auth, context) => {
    const businessId = context.params.id?.trim() ?? "";

    if (!UUID_PATTERN.test(businessId)) {
      return jsonError("A valid business id is required.", 400);
    }

    const { data, error } = await loadOwnedSettings(businessId, auth.workspaceUserId);

    if (error) {
      return isMissingAutomationColumn(error)
        ? migrationRequired()
        : jsonError("Failed to load automation settings.", 500);
    }

    if (!data) {
      return jsonError("Business not found.", 404);
    }

    const body: AutomationSettingsResponse = {
      business_id: businessId,
      automation_settings: parseAutomationSettings(data.automation_settings),
    };

    return NextResponse.json(body);
  },
  { requiredPermission: "edit_settings" }
);

export const PATCH = withWorkspaceMutation<RouteContext>(
  async (request, auth, context) => {
    const businessId = context.params.id?.trim() ?? "";

    if (!UUID_PATTERN.test(businessId)) {
      return jsonError("A valid business id is required.", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Request body must be valid JSON.", 400);
    }

    const parsed = parseAutomationSettingsPatch(
      body && typeof body === "object"
        ? (body as Record<string, unknown>).automation_settings
        : undefined
    );

    if (!parsed.ok) {
      return jsonError(parsed.error, 400);
    }

    const { supabase, data, error } = await loadOwnedSettings(
      businessId,
      auth.workspaceUserId
    );

    if (error) {
      return isMissingAutomationColumn(error)
        ? migrationRequired()
        : jsonError("Failed to load automation settings.", 500);
    }

    if (!data) {
      return jsonError("Business not found.", 404);
    }

    const nextSettings: BusinessAutomationSettings = {
      ...parseAutomationSettings(data.automation_settings),
      ...parsed.patch,
    };

    const { data: updated, error: updateError } = await supabase
      .from("businesses")
      .update({ automation_settings: nextSettings })
      .eq("id", businessId)
      .eq("user_id", auth.workspaceUserId)
      .select("automation_settings")
      .single();

    if (updateError || !updated) {
      return jsonError("Failed to save automation settings.", 500);
    }

    const response: AutomationSettingsResponse = {
      business_id: businessId,
      automation_settings: parseAutomationSettings(updated.automation_settings),
    };

    return NextResponse.json(response);
  },
  { permission: "edit_settings", businessIdParam: "id" }
);
