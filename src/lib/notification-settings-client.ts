import { getAuthHeaders } from "@/lib/auth-headers";
import { BusinessSmtpSettings } from "@/types";

export async function sendSmtpTestEmail(input: {
  businessId: string;
  recipientEmail: string;
  smtpSettings: BusinessSmtpSettings;
}): Promise<{ success: boolean; simulated: boolean; message: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/settings/test-smtp", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_id: input.businessId,
      recipient_email: input.recipientEmail,
      smtp_settings: input.smtpSettings,
    }),
  });

  const body = (await response.json()) as {
    success?: boolean;
    simulated?: boolean;
    message?: string;
    error?: string;
  };

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to send SMTP test email.");
  }

  return {
    success: true,
    simulated: body.simulated ?? false,
    message: body.message ?? "Test email sent.",
  };
}
