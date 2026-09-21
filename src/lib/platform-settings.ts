import { SupabaseClient } from "@supabase/supabase-js";

export interface PlatformSettings {
  id: number;
  vapi_margin_percentage: number;
  fx_risk_buffer_percentage: number;
  fallback_usd_to_inr: number;
  updated_at: string;
}

export interface PlatformSettingsPatch {
  vapi_margin_percentage?: number;
  fx_risk_buffer_percentage?: number;
  fallback_usd_to_inr?: number;
}

export const DEFAULT_PLATFORM_SETTINGS: Omit<PlatformSettings, "updated_at"> = {
  id: 1,
  vapi_margin_percentage: 30,
  fx_risk_buffer_percentage: 2,
  fallback_usd_to_inr: 86,
};

const OPEN_ER_API_URL = "https://open.er-api.com/v6/latest/USD";

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizePlatformSettings(
  row: Record<string, unknown> | null | undefined
): PlatformSettings {
  const defaults = DEFAULT_PLATFORM_SETTINGS;

  return {
    id: 1,
    vapi_margin_percentage: toNumber(
      row?.vapi_margin_percentage,
      defaults.vapi_margin_percentage
    ),
    fx_risk_buffer_percentage: toNumber(
      row?.fx_risk_buffer_percentage,
      defaults.fx_risk_buffer_percentage
    ),
    fallback_usd_to_inr: toNumber(
      row?.fallback_usd_to_inr,
      defaults.fallback_usd_to_inr
    ),
    updated_at:
      typeof row?.updated_at === "string"
        ? row.updated_at
        : new Date().toISOString(),
  };
}

export async function fetchPlatformSettings(
  supabase: SupabaseClient
): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select(
      "id, vapi_margin_percentage, fx_risk_buffer_percentage, fallback_usd_to_inr, updated_at"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load platform settings.");
  }

  return normalizePlatformSettings(data as Record<string, unknown> | null);
}

export async function updatePlatformSettings(
  supabase: SupabaseClient,
  patch: PlatformSettingsPatch
): Promise<PlatformSettings> {
  const updates: Record<string, number | string> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.vapi_margin_percentage !== undefined) {
    updates.vapi_margin_percentage = patch.vapi_margin_percentage;
  }

  if (patch.fx_risk_buffer_percentage !== undefined) {
    updates.fx_risk_buffer_percentage = patch.fx_risk_buffer_percentage;
  }

  if (patch.fallback_usd_to_inr !== undefined) {
    updates.fallback_usd_to_inr = patch.fallback_usd_to_inr;
  }

  const { data, error } = await supabase
    .from("platform_settings")
    .update(updates)
    .eq("id", 1)
    .select(
      "id, vapi_margin_percentage, fx_risk_buffer_percentage, fallback_usd_to_inr, updated_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update platform settings.");
  }

  return normalizePlatformSettings(data as Record<string, unknown>);
}

export async function fetchLiveUsdToInrRate(
  fallbackRate: number
): Promise<number> {
  try {
    const response = await fetch(OPEN_ER_API_URL, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`FX API responded with ${response.status}.`);
    }

    const payload = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };

    const inrRate = payload.rates?.INR;

    if (
      payload.result !== "success" ||
      typeof inrRate !== "number" ||
      !Number.isFinite(inrRate) ||
      inrRate <= 0
    ) {
      throw new Error("FX API returned an invalid INR rate.");
    }

    return inrRate;
  } catch (error) {
    console.warn("[platform-settings] Live USD/INR fetch failed; using fallback.", {
      fallbackRate,
      error: error instanceof Error ? error.message : error,
    });

    return fallbackRate;
  }
}

export function validatePlatformSettingsPatch(
  patch: PlatformSettingsPatch
): string | null {
  if (
    patch.vapi_margin_percentage !== undefined &&
    (!Number.isFinite(patch.vapi_margin_percentage) ||
      patch.vapi_margin_percentage < 0 ||
      patch.vapi_margin_percentage > 200)
  ) {
    return "Margin must be between 0% and 200%.";
  }

  if (
    patch.fx_risk_buffer_percentage !== undefined &&
    (!Number.isFinite(patch.fx_risk_buffer_percentage) ||
      patch.fx_risk_buffer_percentage < 0 ||
      patch.fx_risk_buffer_percentage > 50)
  ) {
    return "FX risk buffer must be between 0% and 50%.";
  }

  if (
    patch.fallback_usd_to_inr !== undefined &&
    (!Number.isFinite(patch.fallback_usd_to_inr) ||
      patch.fallback_usd_to_inr <= 0 ||
      patch.fallback_usd_to_inr > 500)
  ) {
    return "Fallback USD/INR rate must be between 0 and 500.";
  }

  if (
    patch.vapi_margin_percentage === undefined &&
    patch.fx_risk_buffer_percentage === undefined &&
    patch.fallback_usd_to_inr === undefined
  ) {
    return "No settings provided to update.";
  }

  return null;
}
