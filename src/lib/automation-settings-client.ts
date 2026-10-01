import { getAuthHeaders } from "@/lib/auth-headers";
import { AutomationSettingsResponse } from "@/lib/automation-settings";
import { BusinessAutomationSettings } from "@/types";

export class AutomationSettingsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null
  ) {
    super(message);
    this.name = "AutomationSettingsError";
  }
}

async function request(
  businessId: string,
  init: RequestInit = {}
): Promise<AutomationSettingsResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/businesses/${encodeURIComponent(businessId)}/automation`,
    {
      ...init,
      headers: {
        ...headers,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    }
  );
  const body = (await response.json().catch(() => ({}))) as Partial<
    AutomationSettingsResponse & { error: string; code: string }
  >;

  if (!response.ok || !body.automation_settings) {
    throw new AutomationSettingsError(
      body.error || "Failed to load automation settings.",
      response.status,
      body.code ?? null
    );
  }

  return body as AutomationSettingsResponse;
}

export function fetchAutomationSettings(
  businessId: string
): Promise<AutomationSettingsResponse> {
  return request(businessId);
}

export function updateAutomationSettings(
  businessId: string,
  patch: Partial<BusinessAutomationSettings>
): Promise<AutomationSettingsResponse> {
  return request(businessId, {
    method: "PATCH",
    body: JSON.stringify({ automation_settings: patch }),
  });
}
