import { getAuthHeaders } from "@/lib/auth-headers";

export interface UserSettingsProfile {
  full_name: string | null;
  billing_address: string | null;
  alternate_phone: string | null;
  default_upi_vpa: string | null;
}

export interface UpdateUserSettingsInput {
  full_name?: string | null;
  billing_address?: string | null;
  alternate_phone?: string | null;
  default_upi_vpa?: string | null;
}

export async function updateUserSettings(
  payload: UpdateUserSettingsInput
): Promise<UserSettingsProfile> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/users/settings", {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as {
    user?: UserSettingsProfile;
    error?: string;
  };

  if (!response.ok || !body.user) {
    throw new Error(body.error || "Failed to save settings.");
  }

  return {
    full_name: body.user.full_name ?? null,
    billing_address: body.user.billing_address ?? null,
    alternate_phone: body.user.alternate_phone ?? null,
    default_upi_vpa: body.user.default_upi_vpa ?? null,
  };
}

export async function requestAccountDeletion(): Promise<string> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/users/delete-account", {
    method: "POST",
    headers,
  });

  const body = (await response.json()) as {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to schedule account deletion.");
  }

  return body.message ?? "Account scheduled for deletion.";
}

function formatDisplayPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  return value;
}

export function formatAlternatePhoneForInput(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const digits = value.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  return digits.slice(-10);
}

export function formatPrimaryPhoneForDisplay(value: string): string {
  return formatDisplayPhone(value);
}
