const SUBSCRIPTION_ACTIVE_EVENTS = new Set([
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.resumed",
]);

/**
 * Webhook retries must not re-grant entitlements. Activation/resume events are
 * skipped once the row is already active. A duplicate `subscription.charged`
 * is skipped when the stored period already covers the incoming period.
 */
export function shouldSkipDuplicateSubscriptionFulfillment(input: {
  event: string;
  storedStatus: string | null | undefined;
  storedPeriodEnd: string | null | undefined;
  incomingPeriodEnd: Date;
}): boolean {
  const storedActive = (input.storedStatus ?? "").toLowerCase() === "active";

  if (!storedActive) {
    return false;
  }

  if (input.event !== "subscription.charged") {
    return SUBSCRIPTION_ACTIVE_EVENTS.has(input.event);
  }

  if (!input.storedPeriodEnd) {
    return false;
  }

  const storedEnd = new Date(input.storedPeriodEnd).getTime();

  return Number.isFinite(storedEnd) && storedEnd >= input.incomingPeriodEnd.getTime();
}
