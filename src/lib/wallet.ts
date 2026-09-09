import { getAuthHeaders } from "@/lib/auth-headers";

export interface LogAdvancePayload {
  contact_id: string;
  amount: number;
  payment_method: "cash_manual" | "bank_transfer" | "cheque" | "upi_link";
  reference_id?: string | null;
}

export interface LogAdvanceResponse {
  wallet_balance: number;
  amount_credited: number;
}

export async function logWalletAdvance(
  payload: LogAdvancePayload
): Promise<LogAdvanceResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/transactions", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as LogAdvanceResponse & { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Failed to log advance payment.");
  }

  return body;
}
