import { SupabaseClient } from "@supabase/supabase-js";
import {
  FREE_PLAN_LEDGER_LIMIT,
  PurchaseType,
} from "@/lib/razorpay-products";
import {
  BusinessEntitlementRow,
  hasEntitlement,
  resolveEffectiveTier,
} from "@/lib/entitlements";
import { getTodayDateStringInIst } from "@/lib/timezone";
import { BusinessSubscriptionTier } from "@/types";

export const FREE_OPEN_PROMISES = 5;

export const BUSINESS_ADDON_SKUS = [
  "promise_register_monthly",
  "settlement_desk_monthly",
] as const;

export type BusinessAddonSku = (typeof BUSINESS_ADDON_SKUS)[number];

export interface BusinessAddonState {
  active: boolean;
  activated_at: string;
  expires_at: string;
}

export type BusinessAddonsMap = Partial<Record<BusinessAddonSku, BusinessAddonState>>;

export interface BusinessMeteringRow {
  id: string;
  subscription_tier?: BusinessSubscriptionTier;
  addons: BusinessAddonsMap | null;
  proof_quota_used_month: number;
  proof_quota_reset_on: string | null;
}

export function isBusinessAddonSku(value: string): value is BusinessAddonSku {
  return (BUSINESS_ADDON_SKUS as readonly string[]).includes(value);
}

export function parseBusinessAddons(value: unknown): BusinessAddonsMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as BusinessAddonsMap;
}

export function isBusinessAddonActive(
  addons: BusinessAddonsMap | null | undefined,
  sku: BusinessAddonSku,
  now = new Date()
): boolean {
  const entry = addons?.[sku];

  if (!entry?.active) {
    return false;
  }

  if (!entry.expires_at) {
    return true;
  }

  return new Date(entry.expires_at).getTime() > now.getTime();
}

function currentIstMonthStart(today = getTodayDateStringInIst()): string {
  return `${today.slice(0, 7)}-01`;
}

export function shouldResetProofQuota(
  proofQuotaResetOn: string | null | undefined,
  today = getTodayDateStringInIst()
): boolean {
  const monthStart = currentIstMonthStart(today);
  return !proofQuotaResetOn || proofQuotaResetOn < monthStart;
}

export function normalizedProofQuotaUsed(
  row: Pick<BusinessMeteringRow, "proof_quota_used_month" | "proof_quota_reset_on">,
  today = getTodayDateStringInIst()
): number {
  if (shouldResetProofQuota(row.proof_quota_reset_on, today)) {
    return 0;
  }

  return Number(row.proof_quota_used_month ?? 0);
}

function toEntitlementRow(row: BusinessMeteringRow): BusinessEntitlementRow {
  return {
    subscription_tier: row.subscription_tier ?? "free",
    addons: row.addons,
  };
}

export function hasSettlementDeskQuotaRemaining(
  row: BusinessMeteringRow,
  today = getTodayDateStringInIst()
): boolean {
  if (hasEntitlement(toEntitlementRow(row), "settlement_desk_unlimited")) {
    return true;
  }

  return normalizedProofQuotaUsed(row, today) < FREE_PLAN_LEDGER_LIMIT;
}

export function settlementDeskQuotaMessage(appUrl: string): string {
  return [
    `Your free Settlement Desk quota (${FREE_PLAN_LEDGER_LIMIT} AI proof scans per month) is used up.`,
    "",
    "Upgrade to Business for unlimited WhatsApp proof extraction:",
    `${appUrl}/dashboard/billing`,
    "",
    "Thank you! - RecoverPe",
  ].join("\n");
}

export async function fetchBusinessMeteringRow(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessMeteringRow | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, subscription_tier, addons, proof_quota_used_month, proof_quota_reset_on"
    )
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load business metering.");
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as string,
    subscription_tier: (data.subscription_tier as BusinessSubscriptionTier) ?? "free",
    addons: parseBusinessAddons(data.addons),
    proof_quota_used_month: Number(data.proof_quota_used_month ?? 0),
    proof_quota_reset_on: (data.proof_quota_reset_on as string | null) ?? null,
  };
}

export async function incrementBusinessProofQuota(
  supabase: SupabaseClient,
  businessId: string
): Promise<void> {
  const today = getTodayDateStringInIst();
  const monthStart = currentIstMonthStart(today);
  const row = await fetchBusinessMeteringRow(supabase, businessId);

  if (!row) {
    return;
  }

  if (hasEntitlement(toEntitlementRow(row), "settlement_desk_unlimited")) {
    return;
  }

  const used = shouldResetProofQuota(row.proof_quota_reset_on, today)
    ? 0
    : Number(row.proof_quota_used_month ?? 0);

  const { error } = await supabase
    .from("businesses")
    .update({
      proof_quota_used_month: used + 1,
      proof_quota_reset_on: monthStart,
    })
    .eq("id", businessId);

  if (error) {
    throw new Error(error.message || "Failed to increment proof quota.");
  }
}

export async function countOpenPromisesForBusiness(
  supabase: SupabaseClient,
  businessId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("payment_promises")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "open");

  if (error) {
    throw new Error(error.message || "Failed to count open promises.");
  }

  return count ?? 0;
}

export async function canRecordInboundPromise(
  supabase: SupabaseClient,
  businessId: string | null
): Promise<boolean> {
  if (!businessId) {
    return true;
  }

  const row = await fetchBusinessMeteringRow(supabase, businessId);

  if (!row) {
    return false;
  }

  if (hasEntitlement(toEntitlementRow(row), "promise_register_unlimited")) {
    return true;
  }

  const openCount = await countOpenPromisesForBusiness(supabase, businessId);
  return openCount < FREE_OPEN_PROMISES;
}

export function addonExpiresAtFromPurchase(now = new Date()): string {
  const expires = new Date(now);
  expires.setUTCDate(expires.getUTCDate() + 30);
  return expires.toISOString();
}

export async function activateBusinessAddon(
  supabase: SupabaseClient,
  businessId: string,
  purchaseType: Extract<
    PurchaseType,
    "promise_register_monthly" | "settlement_desk_monthly"
  >
): Promise<void> {
  const row = await fetchBusinessMeteringRow(supabase, businessId);

  if (!row) {
    throw new Error("Business not found for add-on activation.");
  }

  const sku = purchaseType as BusinessAddonSku;
  const activatedAt = new Date().toISOString();
  const addons: BusinessAddonsMap = {
    ...parseBusinessAddons(row.addons),
    [sku]: {
      active: true,
      activated_at: activatedAt,
      expires_at: addonExpiresAtFromPurchase(),
    },
  };

  const baseTier = row.subscription_tier ?? "free";
  const nextTier =
    resolveEffectiveTier({ subscription_tier: baseTier, addons }) === "business"
      ? baseTier === "premium" ? "premium" : "business"
      : baseTier;

  const { error } = await supabase
    .from("businesses")
    .update({
      addons,
      subscription_tier: nextTier,
    })
    .eq("id", businessId);

  if (error) {
    throw new Error(error.message || "Failed to activate business add-on.");
  }
}
