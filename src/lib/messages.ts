import { SendWhatsAppReminderPayload, SendWhatsAppReminderResponse } from "@/types";
import { getAuthHeaders } from "@/lib/businesses";
import { hasCollectionDetails } from "@/lib/collection-details";
import { useWorkspaceStore } from "@/store/workspace-store";

export class CollectionDetailsRequiredError extends Error {
  constructor() {
    super("Collection details are required before sending a payment link.");
    this.name = "CollectionDetailsRequiredError";
  }
}

export function isCollectionDetailsRequiredError(error: unknown): boolean {
  return error instanceof CollectionDetailsRequiredError;
}

export async function sendWhatsAppReminder(
  payload: SendWhatsAppReminderPayload
): Promise<SendWhatsAppReminderResponse> {
  const state = useWorkspaceStore.getState();
  const business =
    state.businesses.find((item) => item.id === state.activeBusinessId) ?? null;

  if (
    !hasCollectionDetails({
      defaultUpiVpa: state.defaultUpiVpa,
      payoutBankAccountNumber: business?.payout_bank_account_number,
    })
  ) {
    state.openCollectionGate();
    throw new CollectionDetailsRequiredError();
  }

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
