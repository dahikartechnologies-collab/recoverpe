import { Contact } from "@/types";
import { getAuthHeaders } from "@/lib/businesses";
import { parseApiJsonResponse } from "@/lib/parse-api-response";

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
  const body = await parseApiJsonResponse<{
    contact?: Contact | null;
    error?: string;
  }>(response);

  if (!response.ok) {
    throw new Error(body.error || "Failed to lookup contact.");
  }

  return body.contact ?? null;
}

export async function ensureContact(input: {
  contact_name: string;
  phone_number: string;
  contact_email?: string | null;
}): Promise<Contact> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/contacts", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const body = await parseApiJsonResponse<{
    contact?: Contact;
    error?: string;
  }>(response);

  if (!response.ok || !body.contact) {
    throw new Error(body.error || "Failed to save contact.");
  }

  return body.contact;
}
