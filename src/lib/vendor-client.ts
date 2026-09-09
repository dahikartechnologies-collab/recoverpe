import { getAuthHeaders } from "@/lib/auth-headers";
import {
  ContactDirectoryResponse,
  PortalLinkResponse,
  ProvisionVirtualAccountResponse,
  VendorDetailResponse,
  WorkspaceSearchResponse,
} from "@/types";

export async function fetchVendorDirectory(options?: {
  page?: number;
  limit?: number;
  businessId?: string | null;
  workspaceMode?: "personal" | "business";
}): Promise<ContactDirectoryResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (options?.page) {
    params.set("page", String(options.page));
  }

  if (options?.limit) {
    params.set("limit", String(options.limit));
  }

  if (options?.workspaceMode === "personal") {
    params.set("workspace_mode", "personal");
  } else if (options?.businessId) {
    params.set("business_id", options.businessId);
  }

  const response = await fetch(`/api/vendors?${params.toString()}`, { headers });
  const body = (await response.json()) as ContactDirectoryResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load vendor directory.");
  }

  return body;
}

export async function fetchVendorDetail(
  contactId: string,
  options?: {
    page?: number;
    limit?: number;
    businessId?: string | null;
    workspaceMode?: "personal" | "business";
  }
): Promise<VendorDetailResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (options?.page) {
    params.set("page", String(options.page));
  }

  if (options?.limit) {
    params.set("limit", String(options.limit));
  }

  if (options?.workspaceMode === "personal") {
    params.set("workspace_mode", "personal");
  } else if (options?.businessId) {
    params.set("business_id", options.businessId);
  }

  const response = await fetch(
    `/api/vendors/${contactId}?${params.toString()}`,
    { headers }
  );
  const body = (await response.json()) as VendorDetailResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load vendor statement.");
  }

  return body;
}

export async function provisionVendorVirtualAccount(
  contactId: string,
  businessId?: string | null
): Promise<ProvisionVirtualAccountResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/vendors/${contactId}/virtual-account`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ business_id: businessId ?? null }),
  });
  const body = (await response.json()) as ProvisionVirtualAccountResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to provision virtual account.");
  }

  return body;
}

export async function generateVendorPortalLink(
  contactId: string,
  businessId?: string | null
): Promise<PortalLinkResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/vendors/${contactId}/portal-link`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ business_id: businessId ?? null }),
  });
  const body = (await response.json()) as PortalLinkResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to generate portal link.");
  }

  return body;
}

export async function searchWorkspace(
  query: string
): Promise<WorkspaceSearchResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`/api/search?${params.toString()}`, { headers });
  const body = (await response.json()) as WorkspaceSearchResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to search workspace.");
  }

  return body;
}
