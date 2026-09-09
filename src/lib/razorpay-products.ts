export const FREE_PLAN_LEDGER_LIMIT = 15;

export const PREMIUM_DISCOUNT_RATE = 0.5;

export const RECOVERY_UPSELL_THRESHOLD_INR = 50_000;

export const PURCHASE_PRODUCTS = {
  subscription_premium: {
    label: "Premium Monthly",
    description: "Unlimited invoices, priority automations, and business tools.",
    amountPaise: 199_900,
    amountLabel: "₹1,999/mo",
    tier: "premium" as const,
    billingMode: "subscription" as const,
    planInterval: "monthly" as const,
  },
  subscription_premium_annual: {
    label: "Premium Annual",
    description: "Save with annual billing — full Premium for 12 months.",
    amountPaise: 1_799_900,
    amountLabel: "₹17,999/yr",
    tier: "premium" as const,
    billingMode: "subscription" as const,
    planInterval: "annual" as const,
  },
  vapi_recharge_100: {
    label: "100 AI Credits",
    description: "Recharge your Sneha AI voice wallet with 100 call credits.",
    amountPaise: 100_000,
    amountLabel: "₹1,000",
    credits: 100,
    tier: "wallet" as const,
    billingMode: "order" as const,
  },
  legal_notice_999: {
    label: "Issue Legal Notice",
    description: "Formal legal notice dispatch for this ledger.",
    amountPaise: 99_900,
    amountLabel: "₹999",
    tier: "micro" as const,
    billingMode: "order" as const,
  },
  samadhaan_499: {
    label: "File Samadhaan",
    description: "Initiate Samadhaan filing workflow for this ledger.",
    amountPaise: 49_900,
    amountLabel: "₹499",
    tier: "micro" as const,
    billingMode: "order" as const,
  },
} as const;

export type PurchaseType = keyof typeof PURCHASE_PRODUCTS;

export type SubscriptionPurchaseType =
  | "subscription_premium"
  | "subscription_premium_annual";

export function isPurchaseType(value: string): value is PurchaseType {
  return value in PURCHASE_PRODUCTS;
}

export function isSubscriptionPurchaseType(
  value: PurchaseType
): value is SubscriptionPurchaseType {
  return (
    value === "subscription_premium" || value === "subscription_premium_annual"
  );
}

export function isMicroTransactionPurchaseType(value: PurchaseType): boolean {
  return value === "legal_notice_999" || value === "samadhaan_499";
}

export function getPurchaseProduct(purchaseType: PurchaseType) {
  return PURCHASE_PRODUCTS[purchaseType];
}

export function getPremiumOrderAmountPaise(eligibleForDiscount: boolean): number {
  const baseAmount = PURCHASE_PRODUCTS.subscription_premium.amountPaise;

  if (!eligibleForDiscount) {
    return baseAmount;
  }

  return Math.round(baseAmount * (1 - PREMIUM_DISCOUNT_RATE));
}

export function getPremiumAmountLabel(eligibleForDiscount: boolean): string {
  const amountPaise = getPremiumOrderAmountPaise(eligibleForDiscount);
  const rupees = amountPaise / 100;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function getSubscriptionPlanId(
  purchaseType: SubscriptionPurchaseType,
  eligibleForDiscount: boolean
): string | null {
  if (purchaseType === "subscription_premium_annual") {
    return process.env.RAZORPAY_PLAN_PREMIUM_ANNUAL?.trim() || null;
  }

  if (
    eligibleForDiscount &&
    process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY_DISCOUNTED?.trim()
  ) {
    return process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY_DISCOUNTED.trim();
  }

  return process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY?.trim() || null;
}

export function getSubscriptionTotalCount(
  purchaseType: SubscriptionPurchaseType
): number {
  return purchaseType === "subscription_premium_annual" ? 1 : 120;
}
