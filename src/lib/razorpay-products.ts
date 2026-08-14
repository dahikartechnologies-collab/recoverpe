export const FREE_PLAN_LEDGER_LIMIT = 15;

export const PURCHASE_PRODUCTS = {
  subscription_premium: {
    label: "Premium Plan",
    description: "Unlimited invoices, priority automations, and business tools.",
    amountPaise: 199_900,
    amountLabel: "₹1,999",
    tier: "premium" as const,
  },
  vapi_recharge_100: {
    label: "100 AI Credits",
    description: "Recharge your Sneha AI voice wallet with 100 call credits.",
    amountPaise: 100_000,
    amountLabel: "₹1,000",
    credits: 100,
    tier: "wallet" as const,
  },
} as const;

export type PurchaseType = keyof typeof PURCHASE_PRODUCTS;

export function isPurchaseType(value: string): value is PurchaseType {
  return value in PURCHASE_PRODUCTS;
}

export function getPurchaseProduct(purchaseType: PurchaseType) {
  return PURCHASE_PRODUCTS[purchaseType];
}
