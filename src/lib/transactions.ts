import {
  CreateTransactionPayload,
  PaymentMethod,
  Transaction,
} from "@/types";
import { getAuthHeaders } from "@/lib/businesses";

export async function logOfflinePayment(
  payload: CreateTransactionPayload
): Promise<Transaction> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/transactions", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as {
    transaction?: Transaction;
    error?: string;
  };

  if (!response.ok || !body.transaction) {
    throw new Error(body.error || "Failed to log offline payment.");
  }

  return body.transaction;
}

export function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case "cash_manual":
      return "Cash";
    case "bank_transfer":
      return "Bank Transfer";
    case "cheque":
      return "Cheque";
    case "upi_link":
      return "UPI";
    default:
      return method.replace(/_/g, " ");
  }
}
