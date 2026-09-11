import { getAuthHeaders } from "@/lib/businesses";
import {
  CreateRazorpayOrderPayload,
  CreateRazorpayOrderResponse,
  CreateRazorpaySubscriptionPayload,
  CreateRazorpaySubscriptionResponse,
  DevFulfillRazorpayPayload,
  DevFulfillRazorpayResponse,
  FulfillRazorpayOrderPayload,
  FulfillRazorpayOrderResponse,
  MicroTransactionFulfillment,
  PurchaseType,
  SubscriptionPurchaseType,
} from "@/types";
import {
  getPurchaseProduct,
  isSubscriptionPurchaseType,
} from "@/lib/razorpay-products";
import {
  trackCheckoutStarted,
  trackPurchaseClientSide,
} from "@/lib/analytics-events";

function purchaseValueInr(purchaseType: PurchaseType): number {
  return getPurchaseProduct(purchaseType).amountPaise / 100;
}

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let razorpayScriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout requires a browser environment."));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${RAZORPAY_SCRIPT_SRC}"]`
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve());
        existingScript.addEventListener("error", () =>
          reject(new Error("Failed to load Razorpay checkout script."))
        );
        return;
      }

      const script = document.createElement("script");
      script.src = RAZORPAY_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Razorpay checkout script."));
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}

export async function createRazorpayOrder(
  purchaseType: Exclude<PurchaseType, SubscriptionPurchaseType>,
  ledgerId?: string
): Promise<CreateRazorpayOrderResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/razorpay/order", {
    method: "POST",
    headers,
    body: JSON.stringify({
      purchase_type: purchaseType,
      ledger_id: ledgerId,
    } satisfies CreateRazorpayOrderPayload),
  });

  const body = (await response.json()) as CreateRazorpayOrderResponse & {
    error?: string;
  };

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to create Razorpay order.");
  }

  return body;
}

export async function createRazorpaySubscription(
  purchaseType: SubscriptionPurchaseType
): Promise<CreateRazorpaySubscriptionResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/razorpay/subscription", {
    method: "POST",
    headers,
    body: JSON.stringify({
      purchase_type: purchaseType,
    } satisfies CreateRazorpaySubscriptionPayload),
  });

  const body = (await response.json()) as CreateRazorpaySubscriptionResponse & {
    error?: string;
  };

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to create Razorpay subscription.");
  }

  return body;
}

export async function devFulfillRazorpayOrder(
  payload: DevFulfillRazorpayPayload
): Promise<DevFulfillRazorpayResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/razorpay/dev-fulfill", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as DevFulfillRazorpayResponse & {
    error?: string;
  };

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to simulate Razorpay fulfillment.");
  }

  return body;
}

export async function devFulfillRazorpaySubscription(
  subscriptionId: string
): Promise<DevFulfillRazorpayResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/razorpay/dev-fulfill-subscription", {
    method: "POST",
    headers,
    body: JSON.stringify({ subscription_id: subscriptionId }),
  });

  const body = (await response.json()) as DevFulfillRazorpayResponse & {
    error?: string;
  };

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to simulate subscription fulfillment.");
  }

  return body;
}

export async function fulfillRazorpayOrderAfterCheckout(
  orderId: string
): Promise<FulfillRazorpayOrderResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/razorpay/fulfill-order", {
    method: "POST",
    headers,
    body: JSON.stringify({ order_id: orderId } satisfies FulfillRazorpayOrderPayload),
  });

  const body = (await response.json()) as FulfillRazorpayOrderResponse & {
    error?: string;
  };

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to fulfill order after checkout.");
  }

  return body;
}

interface StartCheckoutInput {
  purchaseType: PurchaseType;
  description: string;
  ledgerId?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess?: (microFulfillment?: MicroTransactionFulfillment | null) => void;
  onDismiss?: () => void;
}

type OneTimePurchaseType = Exclude<PurchaseType, SubscriptionPurchaseType>;

export async function startRazorpayCheckout({
  purchaseType,
  description,
  ledgerId,
  prefill,
  onSuccess,
  onDismiss,
}: StartCheckoutInput): Promise<void> {
  // Single entry point for every SKU, including subscriptions delegated below,
  // so InitiateCheckout fires exactly once per attempt.
  trackCheckoutStarted({
    purchaseType,
    valueInr: purchaseValueInr(purchaseType),
  });

  if (isSubscriptionPurchaseType(purchaseType)) {
    return startRazorpaySubscriptionCheckout({
      purchaseType,
      description,
      prefill,
      onSuccess: () => onSuccess?.(null),
      onDismiss,
    });
  }

  const orderResponse = await createRazorpayOrder(
    purchaseType as OneTimePurchaseType,
    ledgerId
  );

  if (orderResponse.simulated) {
    console.warn(
      "[Recoverpe Razorpay Dev Bypass] Simulating checkout fulfillment locally."
    );

    await devFulfillRazorpayOrder({ order_id: orderResponse.order.id });
    const fulfillment = await fulfillRazorpayOrderAfterCheckout(
      orderResponse.order.id
    );
    onSuccess?.(fulfillment.micro_fulfillment ?? null);
    return;
  }

  if (!orderResponse.key) {
    throw new Error("Razorpay public key is not configured.");
  }

  const publicKey = orderResponse.key;

  await loadRazorpayScript();

  if (!window.Razorpay) {
    throw new Error("Razorpay checkout is unavailable.");
  }

  await new Promise<void>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: publicKey,
      amount: orderResponse.order.amount,
      currency: orderResponse.order.currency,
      name: "Recoverpe",
      description,
      order_id: orderResponse.order.id,
      prefill,
      theme: {
        color: "#0A0A0A",
      },
      handler: async () => {
        try {
          const fulfillment = await fulfillRazorpayOrderAfterCheckout(
            orderResponse.order.id
          );
          // GA4 purchase is emitted server-side from the webhook; this is the
          // Pixel counterpart, which has no server-side path today.
          trackPurchaseClientSide({
            purchaseType,
            valueInr: orderResponse.order.amount / 100,
            transactionId: orderResponse.order.id,
          });
          onSuccess?.(fulfillment.micro_fulfillment ?? null);
          resolve();
        } catch (fulfillError) {
          reject(
            fulfillError instanceof Error
              ? fulfillError
              : new Error("Failed to fulfill order after payment.")
          );
        }
      },
      modal: {
        ondismiss: () => {
          onDismiss?.();
          reject(new Error("Payment cancelled."));
        },
      },
    });

    checkout.on("payment.failed", () => {
      reject(new Error("Payment failed. Please try again."));
    });

    checkout.open();
  });
}

interface StartSubscriptionCheckoutInput {
  purchaseType: SubscriptionPurchaseType;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess?: () => void;
  onDismiss?: () => void;
}

export async function startRazorpaySubscriptionCheckout({
  purchaseType,
  description,
  prefill,
  onSuccess,
  onDismiss,
}: StartSubscriptionCheckoutInput): Promise<void> {
  const subscriptionResponse = await createRazorpaySubscription(purchaseType);

  if (subscriptionResponse.simulated) {
    console.warn(
      "[Recoverpe Razorpay Dev Bypass] Simulating subscription fulfillment locally."
    );

    await devFulfillRazorpaySubscription(subscriptionResponse.subscription.id);
    onSuccess?.();
    return;
  }

  if (!subscriptionResponse.key) {
    throw new Error("Razorpay public key is not configured.");
  }

  const publicKey = subscriptionResponse.key;

  await loadRazorpayScript();

  if (!window.Razorpay) {
    throw new Error("Razorpay checkout is unavailable.");
  }

  await new Promise<void>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: publicKey,
      name: "Recoverpe",
      description,
      subscription_id: subscriptionResponse.subscription.id,
      prefill,
      theme: {
        color: "#0A0A0A",
      },
      handler: () => {
        trackPurchaseClientSide({
          purchaseType,
          valueInr: purchaseValueInr(purchaseType),
          transactionId: subscriptionResponse.subscription.id,
        });
        onSuccess?.();
        resolve();
      },
      modal: {
        ondismiss: () => {
          onDismiss?.();
          reject(new Error("Payment cancelled."));
        },
      },
    });

    checkout.on("payment.failed", () => {
      reject(new Error("Payment failed. Please try again."));
    });

    checkout.open();
  });
}

export async function recordRecoveryUpsell(): Promise<{
  eligible_for_discount: boolean;
  already_shown: boolean;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/users/recovery-upsell", {
    method: "POST",
    headers,
  });

  const body = (await response.json()) as {
    eligible_for_discount?: boolean;
    already_shown?: boolean;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to record recovery upsell.");
  }

  return {
    eligible_for_discount: Boolean(body.eligible_for_discount),
    already_shown: Boolean(body.already_shown),
  };
}
