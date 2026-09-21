import { Tier } from "@/types";

export const FREE_PLAN_LEDGER_LIMIT = 15;

export const PREMIUM_DISCOUNT_RATE = 0.5;

export const RECOVERY_UPSELL_THRESHOLD_INR = 50_000;

export const PURCHASE_PRODUCTS = {
  subscription_starter_monthly: {
    label: "Starter Monthly",
    description:
      "Core Khata, WhatsApp reminders, inbound AI bot, and live inbox.",
    amountPaise: 49_900,
    amountLabel: "₹499/mo",
    tier: "starter" as const,
    billingMode: "subscription" as const,
    planInterval: "monthly" as const,
  },
  subscription_starter_annual: {
    label: "Starter Annual",
    description: "Save with annual Starter billing.",
    amountPaise: 499_900,
    amountLabel: "₹4,999/yr",
    tier: "starter" as const,
    billingMode: "subscription" as const,
    planInterval: "annual" as const,
  },
  subscription_business_monthly: {
    label: "Business Monthly",
    description:
      "Zero-MDR Smart Checkout, Settlement Desk, Promise Register, and SMS receipts.",
    amountPaise: 99_900,
    amountLabel: "₹999/mo",
    tier: "business" as const,
    billingMode: "subscription" as const,
    planInterval: "monthly" as const,
  },
  subscription_business_annual: {
    label: "Business Annual",
    description: "Save with annual Business billing.",
    amountPaise: 999_900,
    amountLabel: "₹9,999/yr",
    tier: "business" as const,
    billingMode: "subscription" as const,
    planInterval: "annual" as const,
  },
  subscription_premium: {
    label: "Premium Monthly",
    description:
      "Command Center: Morning Briefing, DHS, Field Agent network, and omnichannel escalation.",
    amountPaise: 199_900,
    amountLabel: "₹1,999/mo",
    tier: "premium" as const,
    billingMode: "subscription" as const,
    planInterval: "monthly" as const,
  },
  subscription_premium_annual: {
    label: "Premium Annual",
    description: "Save with annual Premium billing.",
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
  bank_verification_5: {
    label: "Secure Bank Linking",
    description:
      "One-time RBI-compliant reverse penny-drop verification for settlement routing.",
    amountPaise: 500,
    amountLabel: "₹5",
    tier: "micro" as const,
    billingMode: "order" as const,
  },
  promise_register_monthly: {
    label: "Promise Register",
    description: "Deprecated — included in Business tier.",
    amountPaise: 29_900,
    amountLabel: "₹299/mo",
    tier: "addon" as const,
    billingMode: "order" as const,
  },
  settlement_desk_monthly: {
    label: "Settlement Desk",
    description: "Deprecated — included in Business tier.",
    amountPaise: 49_900,
    amountLabel: "₹499/mo",
    tier: "addon" as const,
    billingMode: "order" as const,
  },
} as const;

export type PurchaseType = keyof typeof PURCHASE_PRODUCTS;

export type SubscriptionPurchaseType =
  | "subscription_starter_monthly"
  | "subscription_starter_annual"
  | "subscription_business_monthly"
  | "subscription_business_annual"
  | "subscription_premium"
  | "subscription_premium_annual";

export type BusinessAddonPurchaseType =
  | "promise_register_monthly"
  | "settlement_desk_monthly";

export function isPurchaseType(value: string): value is PurchaseType {
  return value in PURCHASE_PRODUCTS;
}

export function isSubscriptionPurchaseType(
  value: PurchaseType | string
): value is SubscriptionPurchaseType {
  return (
    value === "subscription_starter_monthly" ||
    value === "subscription_starter_annual" ||
    value === "subscription_business_monthly" ||
    value === "subscription_business_annual" ||
    value === "subscription_premium" ||
    value === "subscription_premium_annual"
  );
}

export const MERCHANT_BANK_VERIFICATION_AMOUNT_PAISE = 500;

export function isMicroTransactionPurchaseType(value: PurchaseType): boolean {
  return value === "legal_notice_999" || value === "samadhaan_499";
}

export function isBankVerificationPurchaseType(value: PurchaseType | string): boolean {
  return value === "bank_verification_5";
}

export function isBusinessAddonPurchaseType(
  value: PurchaseType
): value is BusinessAddonPurchaseType {
  return (
    value === "promise_register_monthly" || value === "settlement_desk_monthly"
  );
}

export function getPurchaseProduct(purchaseType: PurchaseType) {
  return PURCHASE_PRODUCTS[purchaseType];
}

export function getSubscriptionTierFromPurchase(
  purchaseType: SubscriptionPurchaseType
): "starter" | "business" | "premium" {
  const product = PURCHASE_PRODUCTS[purchaseType];

  if (product.tier === "starter" || product.tier === "business") {
    return product.tier;
  }

  return "premium";
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
  switch (purchaseType) {
    case "subscription_starter_monthly":
      return process.env.RAZORPAY_PLAN_STARTER_MONTHLY?.trim() || null;
    case "subscription_starter_annual":
      return process.env.RAZORPAY_PLAN_STARTER_ANNUAL?.trim() || null;
    case "subscription_business_monthly":
      return process.env.RAZORPAY_PLAN_BUSINESS_MONTHLY?.trim() || null;
    case "subscription_business_annual":
      return process.env.RAZORPAY_PLAN_BUSINESS_ANNUAL?.trim() || null;
    case "subscription_premium_annual":
      return process.env.RAZORPAY_PLAN_PREMIUM_ANNUAL?.trim() || null;
    case "subscription_premium":
      if (
        eligibleForDiscount &&
        process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY_DISCOUNTED?.trim()
      ) {
        return process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY_DISCOUNTED.trim();
      }

      return process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY?.trim() || null;
    default:
      return null;
  }
}

export function getSubscriptionTotalCount(
  purchaseType: SubscriptionPurchaseType
): number {
  return purchaseType.endsWith("_annual") ? 1 : 120;
}

export function resolveSubscriptionPurchaseType(
  tier: Tier,
  interval: "monthly" | "annual"
): SubscriptionPurchaseType {
  switch (tier) {
    case "starter":
      return interval === "annual"
        ? "subscription_starter_annual"
        : "subscription_starter_monthly";
    case "business":
      return interval === "annual"
        ? "subscription_business_annual"
        : "subscription_business_monthly";
    case "premium":
      return interval === "annual"
        ? "subscription_premium_annual"
        : "subscription_premium";
    default: {
      const _exhaustive: never = tier;
      throw new Error(`Unsupported subscription tier: ${String(_exhaustive)}`);
    }
  }
}
