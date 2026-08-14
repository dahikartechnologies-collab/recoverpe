import { SendWhatsAppReminderPayload, SendWhatsAppReminderResponse } from "@/types";
import { getAuthHeaders } from "@/lib/businesses";

export async function sendWhatsAppReminder(
  payload: SendWhatsAppReminderPayload
): Promise<SendWhatsAppReminderResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/messages/send", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as SendWhatsAppReminderResponse & {
    error?: string;
  };

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to send WhatsApp reminder.");
  }

  return body;
}
