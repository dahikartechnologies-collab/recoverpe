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
