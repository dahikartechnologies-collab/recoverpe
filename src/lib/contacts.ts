import { Contact } from "@/types";
import { getAuthHeaders } from "@/lib/businesses";

export async function lookupContactByPhone(
  phone: string
): Promise<Contact | null> {
  const normalized = phone.replace(/\D/g, "");

  if (normalized.length !== 10) {
    return null;
  }

  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ phone: normalized });
  const response = await fetch(`/api/contacts?${params.toString()}`, { headers });
  const body = (await response.json()) as {
    contact?: Contact | null;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to lookup contact.");
  }

  return body.contact ?? null;
}
