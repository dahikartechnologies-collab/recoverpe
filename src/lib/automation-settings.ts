import { BusinessAutomationSettings } from "@/types";

export const DEFAULT_AUTOMATION_SETTINGS: BusinessAutomationSettings = {
  recovery_autopilot: true,
  smart_stocks_receipts: true,
  b2b_network: false,
};

export const AUTOMATION_SETTING_KEYS = [
  "recovery_autopilot",
  "smart_stocks_receipts",
  "b2b_network",
] as const;

export type AutomationSettingKey = (typeof AUTOMATION_SETTING_KEYS)[number];

export interface AutomationSettingsResponse {
  business_id: string;
  automation_settings: BusinessAutomationSettings;
}

export function isAutomationSettingKey(value: unknown): value is AutomationSettingKey {
  return (
    typeof value === "string" &&
    (AUTOMATION_SETTING_KEYS as readonly string[]).includes(value)
  );
}

/** Missing or malformed keys fall back to the defaults, never to "off". */
export function parseAutomationSettings(value: unknown): BusinessAutomationSettings {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const settings = { ...DEFAULT_AUTOMATION_SETTINGS };

  for (const key of AUTOMATION_SETTING_KEYS) {
    if (typeof record[key] === "boolean") {
      settings[key] = record[key] as boolean;
    }
  }

  return settings;
}

/** Accepts a partial patch; rejects unknown keys and non-boolean values. */
export function parseAutomationSettingsPatch(
  value: unknown
): { ok: true; patch: Partial<BusinessAutomationSettings> } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "automation_settings must be an object." };
  }

  const patch: Partial<BusinessAutomationSettings> = {};
  const entries = Object.keys(value as Record<string, unknown>);

  if (entries.length === 0) {
    return { ok: false, error: "Provide at least one automation setting." };
  }

  for (const key of entries) {
    const raw = (value as Record<string, unknown>)[key];

    if (!isAutomationSettingKey(key)) {
      return { ok: false, error: `Unknown automation setting: ${key}.` };
    }

    if (typeof raw !== "boolean") {
      return { ok: false, error: `${key} must be true or false.` };
    }

    patch[key] = raw;
  }

  return { ok: true, patch };
}
