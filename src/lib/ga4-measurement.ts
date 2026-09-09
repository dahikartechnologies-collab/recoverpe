import { createHash } from "crypto";

export interface Ga4PurchaseEventParams {
  userId: string;
  transactionId: string;
  purchaseType: string;
  valueInr: number;
}

export function isGa4MeasurementProtocolConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() &&
      process.env.GA4_MEASUREMENT_PROTOCOL_SECRET?.trim()
  );
}

function deriveGa4ClientId(userId: string): string {
  const digest = createHash("sha256").update(userId).digest("hex").slice(0, 16);
  return `recoverpe.${digest}`;
}

export async function trackGa4PurchaseEvent(
  params: Ga4PurchaseEventParams
): Promise<void> {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const apiSecret = process.env.GA4_MEASUREMENT_PROTOCOL_SECRET?.trim();

  if (!measurementId || !apiSecret) {
    return;
  }

  const endpoint = new URL("https://www.google-analytics.com/mp/collect");
  endpoint.searchParams.set("measurement_id", measurementId);
  endpoint.searchParams.set("api_secret", apiSecret);

  const body = {
    client_id: deriveGa4ClientId(params.userId),
    user_id: params.userId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: params.transactionId,
          value: params.valueInr,
          currency: "INR",
          items: [
            {
              item_id: params.purchaseType,
              item_name: params.purchaseType,
              price: params.valueInr,
              quantity: 1,
            },
          ],
        },
      },
    ],
  };

  try {
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(
        `[GA4 MP] Purchase event rejected (${response.status}) for ${params.transactionId}.`
      );
    }
  } catch (error) {
    console.error("[GA4 MP] Purchase event failed:", error);
  }
}

/** Fire-and-forget wrapper so webhook handlers are not blocked on telemetry. */
export function emitGa4PurchaseEvent(params: Ga4PurchaseEventParams): void {
  void trackGa4PurchaseEvent(params);
}
