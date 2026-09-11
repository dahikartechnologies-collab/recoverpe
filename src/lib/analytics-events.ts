/**
 * Client-side conversion tracking for GA4 and Meta Pixel.
 *
 * PII rule: never pass phone numbers, customer names, UTRs, or email addresses
 * into an event payload. Amounts and opaque ids only.
 */

type GtagFn = (
  command: "event",
  eventName: string,
  params?: Record<string, unknown>
) => void;

type FbqFn = (
  command: "track" | "trackCustom",
  eventName: string,
  params?: Record<string, unknown>
) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    fbq?: FbqFn;
  }
}

function gtagEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  try {
    window.gtag("event", name, params);
  } catch {
    // Analytics must never break a user flow.
  }
}

function pixelEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  try {
    window.fbq("track", name, params);
  } catch {
    // Analytics must never break a user flow.
  }
}

/** Account created and verified. */
export function trackSignUp(method: "email" | "mobile"): void {
  gtagEvent("sign_up", { method });
  pixelEvent("CompleteRegistration", { status: method });
}

/** First real intent signal: the user put a receivable into the system. */
export function trackLedgerCreated(params: {
  valueInr: number;
  isFirstLedger: boolean;
}): void {
  gtagEvent("ledger_created", {
    value: params.valueInr,
    currency: "INR",
    first_ledger: params.isFirstLedger,
  });

  if (params.isFirstLedger) {
    pixelEvent("Lead", { value: params.valueInr, currency: "INR" });
  }
}

/** A debtor opened a payment link. */
export function trackPayPageViewed(params: { amountDueInr: number }): void {
  gtagEvent("payment_link_viewed", {
    value: params.amountDueInr,
    currency: "INR",
  });
  pixelEvent("ViewContent", {
    content_type: "payment_link",
    value: params.amountDueInr,
    currency: "INR",
  });
}

/** A debtor submitted proof of payment. */
export function trackPaymentClaimed(params: { amountInr: number | null }): void {
  gtagEvent("payment_claimed", {
    value: params.amountInr ?? 0,
    currency: "INR",
  });
}

/** Razorpay checkout opened. */
export function trackCheckoutStarted(params: {
  purchaseType: string;
  valueInr: number;
}): void {
  gtagEvent("begin_checkout", {
    value: params.valueInr,
    currency: "INR",
    items: [{ item_id: params.purchaseType, item_name: params.purchaseType }],
  });
  pixelEvent("InitiateCheckout", {
    value: params.valueInr,
    currency: "INR",
    content_ids: [params.purchaseType],
    content_type: "product",
  });
}

/**
 * Razorpay checkout succeeded in the browser.
 *
 * GA4 `purchase` is emitted server-side from the Razorpay webhook, which is the
 * authoritative signal. This fires the Pixel equivalent only, because the Pixel
 * has no server-side counterpart without the Conversions API.
 */
export function trackPurchaseClientSide(params: {
  purchaseType: string;
  valueInr: number;
  transactionId: string;
}): void {
  pixelEvent("Purchase", {
    value: params.valueInr,
    currency: "INR",
    content_ids: [params.purchaseType],
    content_type: "product",
    order_id: params.transactionId,
  });
}

/** CSV import finished. */
export function trackCsvImportCompleted(params: { rowCount: number }): void {
  gtagEvent("csv_import_completed", { row_count: params.rowCount });
}
