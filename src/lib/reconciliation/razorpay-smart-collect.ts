export interface RazorpaySmartCollectWebhookPayload {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        method?: string;
        status?: string;
      };
    };
    virtual_account?: {
      entity?: {
        id?: string;
      };
    };
  };
}

export interface ParsedRazorpaySmartCollectCredit {
  event: string;
  externalEventId: string;
  externalPaymentId: string;
  amountPaise: number;
  amountRupees: number;
  currency: string;
  razorpayVirtualAccountId: string;
  paymentMethod: string | null;
  rawPayload: RazorpaySmartCollectWebhookPayload;
}

export function isRazorpaySmartCollectCreditEvent(event: string | undefined): boolean {
  return event === "virtual_account.credited";
}

export function parseRazorpaySmartCollectCredit(
  payload: RazorpaySmartCollectWebhookPayload
): ParsedRazorpaySmartCollectCredit | null {
  if (!isRazorpaySmartCollectCreditEvent(payload.event)) {
    return null;
  }

  const paymentEntity = payload.payload?.payment?.entity;
  const virtualAccountEntity = payload.payload?.virtual_account?.entity;

  if (!paymentEntity?.id || !paymentEntity.amount || paymentEntity.amount <= 0) {
    return null;
  }

  if (!virtualAccountEntity?.id) {
    return null;
  }

  const amountPaise = Math.round(paymentEntity.amount);
  const amountRupees = amountPaise / 100;

  return {
    event: payload.event ?? "virtual_account.credited",
    externalEventId: paymentEntity.id,
    externalPaymentId: paymentEntity.id,
    amountPaise,
    amountRupees,
    currency: paymentEntity.currency ?? "INR",
    razorpayVirtualAccountId: virtualAccountEntity.id,
    paymentMethod: paymentEntity.method ?? null,
    rawPayload: payload,
  };
}

export function isPostgresUniqueViolation(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) {
    return false;
  }

  return (
    error.code === "23505" ||
    Boolean(error.message?.toLowerCase().includes("duplicate key"))
  );
}
