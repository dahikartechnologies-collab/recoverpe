import { getAuthHeaders } from "@/lib/businesses";
import {
  CreateRazorpayOrderPayload,
  CreateRazorpayOrderResponse,
  DevFulfillRazorpayPayload,
  DevFulfillRazorpayResponse,
  PurchaseType,
} from "@/types";

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
  purchaseType: PurchaseType
): Promise<CreateRazorpayOrderResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/razorpay/order", {
    method: "POST",
    headers,
    body: JSON.stringify({ purchase_type: purchaseType } satisfies CreateRazorpayOrderPayload),
  });

  const body = (await response.json()) as CreateRazorpayOrderResponse & {
    error?: string;
  };

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to create Razorpay order.");
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

interface StartCheckoutInput {
  purchaseType: PurchaseType;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess?: () => void;
  onDismiss?: () => void;
}

export async function startRazorpayCheckout({
  purchaseType,
  description,
  prefill,
  onSuccess,
  onDismiss,
}: StartCheckoutInput): Promise<void> {
  const orderResponse = await createRazorpayOrder(purchaseType);

  if (orderResponse.simulated) {
    console.warn(
      "[Recoverpe Razorpay Dev Bypass] Simulating checkout fulfillment locally."
    );

    await devFulfillRazorpayOrder({ order_id: orderResponse.order.id });
    onSuccess?.();
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
      handler: () => {
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
