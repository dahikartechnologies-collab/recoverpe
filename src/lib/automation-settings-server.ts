import { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_AUTOMATION_SETTINGS,
  parseAutomationSettings,
} from "@/lib/automation-settings";
import { BusinessAutomationSettings } from "@/types";

const UNDEFINED_COLUMN = "42703";

export class AutomationSettingsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomationSettingsUnavailableError";
  }
}

export function isMissingAutomationColumn(error: { code?: string } | null): boolean {
  return error?.code === UNDEFINED_COLUMN;
}

/**
 * Personal ledgers have no business row and keep the defaults. Before
 * migration 065 the column does not exist, which also means defaults. Any
 * other read failure throws so dispatchers fail closed instead of sending.
 */
export async function fetchBusinessAutomationSettings(
  supabase: SupabaseClient,
  businessId: string | null | undefined
): Promise<BusinessAutomationSettings> {
  if (!businessId) {
    return { ...DEFAULT_AUTOMATION_SETTINGS };
  }

  const { data, error } = await supabase
    .from("businesses")
    .select("automation_settings")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    if (isMissingAutomationColumn(error)) {
      console.warn(
        "[AUTOMATION SETTINGS] businesses.automation_settings missing; run migration 065. Using defaults."
      );
      return { ...DEFAULT_AUTOMATION_SETTINGS };
    }

    throw new AutomationSettingsUnavailableError(
      error.message || "Failed to read automation settings."
    );
  }

  return parseAutomationSettings(data?.automation_settings);
}
