import { Business, CreateBusinessPayload } from "@/types";
import { getAuthHeaders } from "@/lib/auth-headers";

export { getAuthHeaders } from "@/lib/auth-headers";

export async function fetchBusinesses(): Promise<Business[]> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/businesses", { headers });
  const payload = (await response.json()) as {
    businesses?: Business[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to load business profiles.");
  }

  return payload.businesses ?? [];
}

export async function createBusinessProfile(
  payload: CreateBusinessPayload
): Promise<Business> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/businesses", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as {
    business?: Business;
    error?: string;
  };

  if (!response.ok || !body.business) {
    throw new Error(body.error || "Failed to create business profile.");
  }

  return body.business;
}

export interface UpdateBusinessSettingsInput {
  msme_reg_no?: string | null;
  khata_auto_approve?: boolean;
  business_name?: string;
  business_address?: string | null;
  gstin?: string | null;
  notification_preferences?: Business["notification_preferences"];
  smtp_settings?: Business["smtp_settings"];
  autopilot_schedule?: number[];
}

export async function updateBusinessSettings(
  businessId: string,
  payload: UpdateBusinessSettingsInput
): Promise<Business> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/businesses/${businessId}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as {
    business?: Business;
    error?: string;
  };

  if (!response.ok || !body.business) {
    throw new Error(body.error || "Failed to save business settings.");
  }

  return body.business;
}

export async function deleteBusinessProfile(businessId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/businesses/${businessId}`, {
    method: "DELETE",
    headers,
  });

  const body = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Failed to delete business.");
  }
}
