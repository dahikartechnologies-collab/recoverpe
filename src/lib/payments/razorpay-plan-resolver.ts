import {
  getPremiumOrderAmountPaise,
  getPurchaseProduct,
  getSubscriptionPlanEnvVarName,
  getSubscriptionPlanId,
  PURCHASE_PRODUCTS,
  SubscriptionPurchaseType,
} from "@/lib/razorpay-products";
import { getRazorpayClient } from "@/lib/payments/razorpay-client";

interface RazorpayPlanEntity {
  id: string;
  period?: string;
  interval?: number;
  item?: {
    amount?: number;
    currency?: string;
    name?: string;
  };
  notes?: Record<string, string>;
}

interface RazorpayPlanListResponse {
  items?: RazorpayPlanEntity[];
}

const resolvedPlanCache = new Map<string, string>();

export class MissingRazorpayPlanError extends Error {
  readonly missingEnv: string;

  constructor(missingEnv: string, message: string) {
    super(message);
    this.name = "MissingRazorpayPlanError";
    this.missingEnv = missingEnv;
  }
}

function getPlanCacheKey(
  purchaseType: SubscriptionPurchaseType,
  eligibleForDiscount: boolean
): string {
  return `${purchaseType}:${eligibleForDiscount ? "discounted" : "standard"}`;
}

export function getSubscriptionPlanAmountPaise(
  purchaseType: SubscriptionPurchaseType,
  eligibleForDiscount: boolean
): number {
  if (purchaseType === "subscription_premium" && eligibleForDiscount) {
    return getPremiumOrderAmountPaise(true);
  }

  return PURCHASE_PRODUCTS[purchaseType].amountPaise;
}

export function getSubscriptionPlanPeriod(
  purchaseType: SubscriptionPurchaseType
): "monthly" | "yearly" {
  return purchaseType.endsWith("_annual") ? "yearly" : "monthly";
}

export function planMatchesSubscriptionPurchase(
  plan: RazorpayPlanEntity,
  purchaseType: SubscriptionPurchaseType,
  amountPaise: number,
  period: "monthly" | "yearly"
): boolean {
  const recoverpePurchaseType = plan.notes?.recoverpe_purchase_type;

  if (recoverpePurchaseType && recoverpePurchaseType !== purchaseType) {
    return false;
  }

  return (
    plan.period === period &&
    (plan.interval ?? 1) === 1 &&
    plan.item?.currency === "INR" &&
    plan.item?.amount === amountPaise
  );
}

async function listRazorpayPlans(): Promise<RazorpayPlanEntity[]> {
  const client = getRazorpayClient();

  if (!client) {
    return [];
  }

  const collected: RazorpayPlanEntity[] = [];
  let skip = 0;
  const pageSize = 100;

  while (true) {
    const response = (await client.plans.all({
      count: pageSize,
      skip,
    })) as RazorpayPlanListResponse;

    const items = response.items ?? [];

    if (items.length === 0) {
      break;
    }

    collected.push(...items);

    if (items.length < pageSize) {
      break;
    }

    skip += pageSize;
  }

  return collected;
}

async function createRazorpayPlan(
  purchaseType: SubscriptionPurchaseType,
  amountPaise: number,
  period: "monthly" | "yearly"
): Promise<string> {
  const client = getRazorpayClient();

  if (!client) {
    throw new MissingRazorpayPlanError(
      getSubscriptionPlanEnvVarName(purchaseType, false),
      "Razorpay credentials are not configured."
    );
  }

  const product = getPurchaseProduct(purchaseType);

  const plan = (await client.plans.create({
    period,
    interval: 1,
    item: {
      name: product.label,
      amount: amountPaise,
      currency: "INR",
      description: product.description,
    },
    notes: {
      recoverpe_purchase_type: purchaseType,
      recoverpe_tier: product.tier,
      recoverpe_interval: period,
    },
  })) as RazorpayPlanEntity;

  if (!plan.id) {
    throw new Error("Razorpay plan creation did not return a plan ID.");
  }

  return plan.id;
}

export async function resolveSubscriptionPlanId(
  purchaseType: SubscriptionPurchaseType,
  eligibleForDiscount: boolean
): Promise<string | null> {
  const cacheKey = getPlanCacheKey(purchaseType, eligibleForDiscount);
  const cachedPlanId = resolvedPlanCache.get(cacheKey);

  if (cachedPlanId) {
    return cachedPlanId;
  }

  const envPlanId = getSubscriptionPlanId(purchaseType, eligibleForDiscount);

  if (envPlanId) {
    resolvedPlanCache.set(cacheKey, envPlanId);
    return envPlanId;
  }

  const client = getRazorpayClient();

  if (!client) {
    return null;
  }

  const amountPaise = getSubscriptionPlanAmountPaise(
    purchaseType,
    eligibleForDiscount
  );
  const period = getSubscriptionPlanPeriod(purchaseType);
  const existingPlans = await listRazorpayPlans();
  const matchedPlan = existingPlans.find((plan) =>
    planMatchesSubscriptionPurchase(plan, purchaseType, amountPaise, period)
  );

  if (matchedPlan?.id) {
    resolvedPlanCache.set(cacheKey, matchedPlan.id);
    return matchedPlan.id;
  }

  const createdPlanId = await createRazorpayPlan(
    purchaseType,
    amountPaise,
    period
  );
  resolvedPlanCache.set(cacheKey, createdPlanId);

  console.info(
    `[razorpay-plan-resolver] Created Razorpay plan ${createdPlanId} for ${purchaseType}. Set ${getSubscriptionPlanEnvVarName(purchaseType, eligibleForDiscount)} in production env to skip auto-provisioning.`
  );

  return createdPlanId;
}

export async function requireSubscriptionPlanId(
  purchaseType: SubscriptionPurchaseType,
  eligibleForDiscount: boolean
): Promise<string> {
  const planId = await resolveSubscriptionPlanId(purchaseType, eligibleForDiscount);

  if (planId) {
    return planId;
  }

  const envVar = getSubscriptionPlanEnvVarName(purchaseType, eligibleForDiscount);

  throw new MissingRazorpayPlanError(
    envVar,
    `Missing Razorpay Plan ID for ${purchaseType}. Configure ${envVar} or Razorpay API credentials.`
  );
}
