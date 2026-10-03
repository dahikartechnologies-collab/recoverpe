import { SupabaseClient } from "@supabase/supabase-js";
import { resolveCurrentBillingPeriod } from "@/lib/billing-period";
import {
  BusinessEntitlementRow,
  resolveEffectiveTier,
} from "@/lib/entitlements";
import { BusinessSubscriptionTier } from "@/types";

export const UNLIMITED_USAGE_QUOTA = 99_999;

export const USAGE_METERING_SELECT =
  "id, subscription_tier, subscription_status, subscription_expires_at, subscription_billing_tier, subscription_interval, subscription_current_period_end, razorpay_subscription_id, addons, quota_smart_collect, usage_smart_collect, quota_sms, usage_sms, quota_whatsapp, usage_whatsapp, quota_vapi_minutes, usage_vapi_minutes, quota_invoices, usage_invoices, pass_through_overages, total_volume_collected_inr, total_gateway_fees_inr";

export interface BusinessUsageMeteringRow {
  id: string;
  subscription_tier: BusinessSubscriptionTier;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  subscription_billing_tier?: BusinessSubscriptionTier | null;
  subscription_interval?: "monthly" | "annual" | string | null;
  subscription_current_period_end?: string | null;
  razorpay_subscription_id?: string | null;
  addons?: unknown;
  quota_smart_collect: number;
  usage_smart_collect: number;
  quota_sms: number;
  usage_sms: number;
  quota_whatsapp: number;
  usage_whatsapp: number;
  quota_vapi_minutes: number;
  usage_vapi_minutes: number;
  quota_invoices: number;
  usage_invoices: number;
  pass_through_overages: boolean;
  total_volume_collected_inr: number;
  total_gateway_fees_inr: number;
}

export interface UsageMetricSnapshot {
  key: string;
  label: string;
  usage: number;
  quota: number;
  unlimited: boolean;
  overageLabel: string | null;
  comingSoon?: boolean;
}

export interface UsageDashboardPayload {
  business_id: string;
  subscription_tier: BusinessSubscriptionTier;
  pass_through_overages: boolean;
  mdr_tax_saved_inr: number;
  total_volume_collected_inr: number;
  total_gateway_fees_inr: number;
  vapi_wallet_balance_inr: number;
  vapi_trial_minutes_remaining: number;
  vapi_call_history: VapiCallUsageRecord[];
  metrics: UsageMetricSnapshot[];
  live_counts: UsageTableCounts;
}

export interface LiveBusinessUsageCounts {
  invoices: number;
  whatsapp: number;
  sms: number;
  smartCollect: number;
  vapiMinutes: number;
  stockMovements: number;
}

export interface UsageTableCounts {
  ledgers: number;
  communications: number;
  inbound_payments: number;
  stock_movements: number;
  whatsapp: number;
  sms: number;
}

export const EMPTY_LIVE_BUSINESS_USAGE: LiveBusinessUsageCounts = {
  invoices: 0,
  whatsapp: 0,
  sms: 0,
  smartCollect: 0,
  vapiMinutes: 0,
  stockMovements: 0,
};

export const EMPTY_USAGE_TABLE_COUNTS: UsageTableCounts = {
  ledgers: 0,
  communications: 0,
  inbound_payments: 0,
  stock_movements: 0,
  whatsapp: 0,
  sms: 0,
};

export interface VapiCallUsageRecord {
  id: string;
  executed_at: string;
  duration_seconds: number | null;
  billed_amount_inr: number;
  vapi_cost_usd: number | null;
  applied_fx_rate: number | null;
  applied_margin_pct: number | null;
  summary: string | null;
  debtor_name: string | null;
}

const TIER_QUOTAS: Record<
  BusinessSubscriptionTier,
  Omit<
    BusinessUsageMeteringRow,
    | "id"
    | "subscription_tier"
    | "subscription_status"
    | "addons"
    | "subscription_interval"
    | "subscription_current_period_end"
    | "pass_through_overages"
    | "total_volume_collected_inr"
    | "total_gateway_fees_inr"
  >
> = {
  free: {
    quota_smart_collect: 0,
    usage_smart_collect: 0,
    quota_sms: 0,
    usage_sms: 0,
    quota_whatsapp: 50,
    usage_whatsapp: 0,
    quota_vapi_minutes: 0,
    usage_vapi_minutes: 0,
    quota_invoices: 15,
    usage_invoices: 0,
  },
  starter: {
    quota_smart_collect: 0,
    usage_smart_collect: 0,
    quota_sms: 0,
    usage_sms: 0,
    quota_whatsapp: 500,
    usage_whatsapp: 0,
    quota_vapi_minutes: 0,
    usage_vapi_minutes: 0,
    quota_invoices: UNLIMITED_USAGE_QUOTA,
    usage_invoices: 0,
  },
  business: {
    quota_smart_collect: 100,
    usage_smart_collect: 0,
    quota_sms: 200,
    usage_sms: 0,
    quota_whatsapp: 2_000,
    usage_whatsapp: 0,
    quota_vapi_minutes: 0,
    usage_vapi_minutes: 0,
    quota_invoices: UNLIMITED_USAGE_QUOTA,
    usage_invoices: 0,
  },
  premium: {
    quota_smart_collect: 500,
    usage_smart_collect: 0,
    quota_sms: 500,
    usage_sms: 0,
    quota_whatsapp: UNLIMITED_USAGE_QUOTA,
    usage_whatsapp: 0,
    quota_vapi_minutes: 10,
    usage_vapi_minutes: 0,
    quota_invoices: UNLIMITED_USAGE_QUOTA,
    usage_invoices: 0,
  },
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toEntitlementRow(
  row: Pick<
    BusinessUsageMeteringRow,
    | "subscription_tier"
    | "subscription_status"
    | "subscription_expires_at"
    | "subscription_billing_tier"
    | "razorpay_subscription_id"
    | "addons"
  >
): BusinessEntitlementRow {
  return {
    subscription_tier: row.subscription_tier,
    subscription_status: row.subscription_status,
    subscription_expires_at: row.subscription_expires_at,
    subscription_billing_tier: row.subscription_billing_tier,
    razorpay_subscription_id: row.razorpay_subscription_id,
    addons: row.addons,
  };
}

export function isUnlimitedQuota(quota: number): boolean {
  return quota >= UNLIMITED_USAGE_QUOTA;
}

export function computeMdrTaxSavedInr(
  totalVolumeCollectedInr: number,
  totalGatewayFeesInr: number
): number {
  const theoreticalMdr = totalVolumeCollectedInr * 0.004;
  const saved = theoreticalMdr - totalGatewayFeesInr;
  return saved > 0 ? Math.round(saved * 100) / 100 : 0;
}

export function normalizeUsageMeteringRow(
  data: Record<string, unknown>
): BusinessUsageMeteringRow {
  return {
    id: data.id as string,
    subscription_tier:
      (data.subscription_tier as BusinessSubscriptionTier) ?? "starter",
    subscription_status: (data.subscription_status as string | null) ?? null,
    subscription_expires_at: (data.subscription_expires_at as string | null) ?? null,
    subscription_billing_tier:
      (data.subscription_billing_tier as BusinessSubscriptionTier | null) ?? null,
    subscription_interval:
      (data.subscription_interval as "monthly" | "annual" | string | null) ?? null,
    subscription_current_period_end:
      (data.subscription_current_period_end as string | null) ?? null,
    razorpay_subscription_id: (data.razorpay_subscription_id as string | null) ?? null,
    addons: data.addons,
    quota_smart_collect: toNumber(data.quota_smart_collect),
    usage_smart_collect: toNumber(data.usage_smart_collect),
    quota_sms: toNumber(data.quota_sms),
    usage_sms: toNumber(data.usage_sms),
    quota_whatsapp: toNumber(data.quota_whatsapp),
    usage_whatsapp: toNumber(data.usage_whatsapp),
    quota_vapi_minutes: toNumber(data.quota_vapi_minutes),
    usage_vapi_minutes: toNumber(data.usage_vapi_minutes),
    quota_invoices: toNumber(data.quota_invoices, 15),
    usage_invoices: toNumber(data.usage_invoices),
    pass_through_overages: Boolean(data.pass_through_overages),
    total_volume_collected_inr: toNumber(data.total_volume_collected_inr),
    total_gateway_fees_inr: toNumber(data.total_gateway_fees_inr),
  };
}

export async function fetchBusinessUsageMeteringRow(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessUsageMeteringRow | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select(USAGE_METERING_SELECT)
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load usage metering.");
  }

  if (!data) {
    return null;
  }

  return normalizeUsageMeteringRow(data as Record<string, unknown>);
}

export async function syncBusinessUsageQuotas(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessUsageMeteringRow | null> {
  const row = await fetchBusinessUsageMeteringRow(supabase, businessId);

  if (!row) {
    return null;
  }

  const effectiveTier = resolveEffectiveTier(toEntitlementRow(row));
  const tierQuotas = TIER_QUOTAS[effectiveTier];

  const needsSync =
    row.quota_smart_collect !== tierQuotas.quota_smart_collect ||
    row.quota_sms !== tierQuotas.quota_sms ||
    row.quota_whatsapp !== tierQuotas.quota_whatsapp ||
    row.quota_vapi_minutes !== tierQuotas.quota_vapi_minutes ||
    row.quota_invoices !== tierQuotas.quota_invoices;

  if (!needsSync) {
    return row;
  }

  const { data, error } = await supabase
    .from("businesses")
    .update({
      quota_smart_collect: tierQuotas.quota_smart_collect,
      quota_sms: tierQuotas.quota_sms,
      quota_whatsapp: tierQuotas.quota_whatsapp,
      quota_vapi_minutes: tierQuotas.quota_vapi_minutes,
      quota_invoices: tierQuotas.quota_invoices,
    })
    .eq("id", businessId)
    .select(USAGE_METERING_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to sync usage quotas.");
  }

  return normalizeUsageMeteringRow(data as Record<string, unknown>);
}

async function countExact(
  query: PromiseLike<{
    count: number | null;
    error: { message?: string } | null;
  }>,
  label: string
): Promise<number> {
  try {
    const { count, error } = await query;

    if (error) {
      console.error(`[usage-metering] Failed to count ${label}:`, error.message);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.error(`[usage-metering] Failed to count ${label}:`, error);
    return 0;
  }
}

async function sumColumnInMemory(
  query: PromiseLike<{
    data: Array<Record<string, unknown>> | null;
    error: { message?: string } | null;
  }>,
  column: string,
  label: string
): Promise<number> {
  try {
    const { data, error } = await query;

    if (error) {
      console.error(`[usage-metering] Failed to sum ${label}:`, error.message);
      return 0;
    }

    return (data ?? []).reduce(
      (total, row) => total + toNumber(row[column]),
      0
    );
  } catch (error) {
    console.error(`[usage-metering] Failed to sum ${label}:`, error);
    return 0;
  }
}

export function toUsageTableCounts(
  live: LiveBusinessUsageCounts
): UsageTableCounts {
  return {
    ledgers: live.invoices,
    communications: live.whatsapp + live.sms,
    inbound_payments: live.smartCollect,
    stock_movements: live.stockMovements,
    whatsapp: live.whatsapp,
    sms: live.sms,
  };
}

export function liveUsageForMetric(
  key: string,
  liveCounts: UsageTableCounts
): number | undefined {
  switch (key) {
    case "smart_collect":
      return liveCounts.inbound_payments;
    case "sms":
      return liveCounts.sms;
    case "whatsapp":
      return liveCounts.whatsapp;
    case "invoices":
      return liveCounts.ledgers;
    default:
      return undefined;
  }
}

export function applyLiveUsageCounts(
  row: BusinessUsageMeteringRow,
  live: LiveBusinessUsageCounts
): BusinessUsageMeteringRow {
  return {
    ...row,
    usage_invoices: live.invoices,
    usage_whatsapp: live.whatsapp,
    usage_sms: live.sms,
    usage_smart_collect: live.smartCollect,
    usage_vapi_minutes: live.vapiMinutes,
  };
}

export async function countLiveBusinessUsage(
  supabase: SupabaseClient,
  businessId: string,
  period: { startIso: string; endIso: string }
): Promise<LiveBusinessUsageCounts> {
  try {
    const countBilledComms = (channel: "whatsapp" | "sms", label: string) =>
      countExact(
        supabase
          .from("communication_logs")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("channel", channel)
          .eq("direction", "outbound")
          .gte("executed_at", period.startIso)
          .lt("executed_at", period.endIso)
          .not("status", "in", "(failed,pending)"),
        label
      );

    const [
      invoices,
      whatsapp,
      sms,
      smartCollect,
      vapiSeconds,
      stockMovements,
    ] = await Promise.all([
      countExact(
        supabase
          .from("ledgers")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .gte("created_at", period.startIso)
          .lt("created_at", period.endIso)
          .neq("status", "cancelled"),
        "invoices"
      ),
      countBilledComms("whatsapp", "whatsapp alerts"),
      countBilledComms("sms", "sms alerts"),
      countExact(
        supabase
          .from("inbound_payments")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .gte("received_at", period.startIso)
          .lt("received_at", period.endIso),
        "smart collect settlements"
      ),
      sumColumnInMemory(
        supabase
          .from("communication_logs")
          .select("duration_seconds")
          .eq("business_id", businessId)
          .eq("type", "vapi_call")
          .gte("executed_at", period.startIso)
          .lt("executed_at", period.endIso),
        "duration_seconds",
        "vapi minutes"
      ),
      countExact(
        supabase
          .from("stock_movements")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .gte("created_at", period.startIso)
          .lt("created_at", period.endIso),
        "stock movements"
      ),
    ]);

    return {
      invoices,
      whatsapp,
      sms,
      smartCollect,
      vapiMinutes: Math.ceil(vapiSeconds / 60),
      stockMovements,
    };
  } catch (error) {
    console.error("[usage-metering] Live usage count failed:", error);
    return { ...EMPTY_LIVE_BUSINESS_USAGE };
  }
}

export async function hydrateBusinessUsageFromLiveCounts(
  supabase: SupabaseClient,
  row: BusinessUsageMeteringRow
): Promise<{
  row: BusinessUsageMeteringRow;
  live_counts: UsageTableCounts;
}> {
  try {
    const period = resolveCurrentBillingPeriod({
      subscriptionCurrentPeriodEnd: row.subscription_current_period_end,
      subscriptionInterval: row.subscription_interval,
    });
    const live = await countLiveBusinessUsage(supabase, row.id, period);
    const hydrated = applyLiveUsageCounts(row, live);

    const { error } = await supabase
      .from("businesses")
      .update({
        usage_invoices: hydrated.usage_invoices,
        usage_whatsapp: hydrated.usage_whatsapp,
        usage_sms: hydrated.usage_sms,
        usage_smart_collect: hydrated.usage_smart_collect,
        usage_vapi_minutes: hydrated.usage_vapi_minutes,
      })
      .eq("id", row.id);

    if (error) {
      console.error("[usage-metering] Failed to persist live usage counts:", error);
    }

    return {
      row: hydrated,
      live_counts: toUsageTableCounts(live),
    };
  } catch (error) {
    console.error("[usage-metering] Live usage hydrate failed:", error);
    return {
      row: applyLiveUsageCounts(row, EMPTY_LIVE_BUSINESS_USAGE),
      live_counts: { ...EMPTY_USAGE_TABLE_COUNTS },
    };
  }
}

export async function fetchVapiCallUsageHistory(
  supabase: SupabaseClient,
  businessId: string,
  limit = 25
): Promise<VapiCallUsageRecord[]> {
  try {
    const { data, error } = await supabase
      .from("communication_logs")
      .select(
        `
          id,
          executed_at,
          duration_seconds,
          billed_amount_inr,
          cost_deducted,
          vapi_cost_usd,
          applied_fx_rate,
          applied_margin_pct,
          summary,
          contacts (
            name
          )
        `
      )
      .eq("business_id", businessId)
      .eq("type", "vapi_call")
      .eq("status", "call_completed")
      .order("executed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(
        "[usage-metering] Failed to load AI voice call history:",
        error.message
      );
      return [];
    }

    return (data ?? []).map((row) => {
      const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;

      return {
        id: row.id as string,
        executed_at: (row.executed_at as string) ?? "",
        duration_seconds:
          row.duration_seconds === null || row.duration_seconds === undefined
            ? null
            : Number(row.duration_seconds),
        billed_amount_inr: Number(row.billed_amount_inr ?? row.cost_deducted ?? 0),
        vapi_cost_usd:
          row.vapi_cost_usd === null || row.vapi_cost_usd === undefined
            ? null
            : Number(row.vapi_cost_usd),
        applied_fx_rate:
          row.applied_fx_rate === null || row.applied_fx_rate === undefined
            ? null
            : Number(row.applied_fx_rate),
        applied_margin_pct:
          row.applied_margin_pct === null || row.applied_margin_pct === undefined
            ? null
            : Number(row.applied_margin_pct),
        summary: (row.summary as string | null) ?? null,
        debtor_name: (contact?.name as string | null) ?? null,
      };
    });
  } catch (error) {
    console.error("[usage-metering] Failed to load AI voice call history:", error);
    return [];
  }
}

export function buildUsageDashboardPayload(
  row: BusinessUsageMeteringRow,
  options: {
    vapi_wallet_balance_inr?: number;
    vapi_call_history?: VapiCallUsageRecord[];
    live_counts?: UsageTableCounts;
  } = {}
): UsageDashboardPayload {
  const effectiveTier = resolveEffectiveTier(toEntitlementRow(row));
  const trialMinutesRemaining = Math.max(
    0,
    row.quota_vapi_minutes - row.usage_vapi_minutes
  );

  const liveCounts = options.live_counts;
  const metrics: UsageMetricSnapshot[] = [
    {
      key: "smart_collect",
      label: "Smart Settlements",
      usage:
        (liveCounts
          ? liveUsageForMetric("smart_collect", liveCounts)
          : undefined) ?? row.usage_smart_collect,
      quota: row.quota_smart_collect,
      unlimited: false,
      overageLabel: null,
    },
    {
      key: "sms",
      label: "DLT SMS",
      usage:
        (liveCounts ? liveUsageForMetric("sms", liveCounts) : undefined) ??
        row.usage_sms,
      quota: row.quota_sms,
      unlimited: false,
      overageLabel: null,
    },
    {
      key: "whatsapp",
      label: "WhatsApp Alerts",
      usage:
        (liveCounts ? liveUsageForMetric("whatsapp", liveCounts) : undefined) ??
        row.usage_whatsapp,
      quota: row.quota_whatsapp,
      unlimited: isUnlimitedQuota(row.quota_whatsapp),
      overageLabel: null,
    },
    {
      key: "invoices",
      label: "Invoices Generated",
      usage:
        (liveCounts ? liveUsageForMetric("invoices", liveCounts) : undefined) ??
        row.usage_invoices,
      quota: row.quota_invoices,
      unlimited:
        isUnlimitedQuota(row.quota_invoices) ||
        effectiveTier === "business" ||
        effectiveTier === "premium",
      overageLabel: null,
    },
  ];

  return {
    business_id: row.id,
    subscription_tier: effectiveTier,
    pass_through_overages: row.pass_through_overages,
    mdr_tax_saved_inr: computeMdrTaxSavedInr(
      row.total_volume_collected_inr,
      row.total_gateway_fees_inr
    ),
    total_volume_collected_inr: row.total_volume_collected_inr,
    total_gateway_fees_inr: row.total_gateway_fees_inr,
    vapi_wallet_balance_inr: options.vapi_wallet_balance_inr ?? 0,
    vapi_trial_minutes_remaining: trialMinutesRemaining,
    vapi_call_history: options.vapi_call_history ?? [],
    metrics,
    live_counts: liveCounts ?? { ...EMPTY_USAGE_TABLE_COUNTS },
  };
}

async function incrementCounter(
  supabase: SupabaseClient,
  businessId: string,
  field: "usage_sms" | "usage_whatsapp" | "usage_invoices" | "usage_vapi_minutes",
  delta = 1
): Promise<void> {
  const row = await fetchBusinessUsageMeteringRow(supabase, businessId);

  if (!row) {
    return;
  }

  const current =
    field === "usage_sms"
      ? row.usage_sms
      : field === "usage_whatsapp"
        ? row.usage_whatsapp
        : field === "usage_invoices"
          ? row.usage_invoices
          : row.usage_vapi_minutes;

  const { error } = await supabase
    .from("businesses")
    .update({ [field]: current + delta })
    .eq("id", businessId);

  if (error) {
    throw new Error(error.message || "Failed to increment usage counter.");
  }
}

export async function incrementSmsUsage(
  supabase: SupabaseClient,
  businessId: string
): Promise<void> {
  await incrementCounter(supabase, businessId, "usage_sms");
}

export async function incrementWhatsappUsage(
  supabase: SupabaseClient,
  businessId: string
): Promise<void> {
  await incrementCounter(supabase, businessId, "usage_whatsapp");
}

export async function incrementInvoiceUsage(
  supabase: SupabaseClient,
  businessId: string
): Promise<void> {
  await incrementCounter(supabase, businessId, "usage_invoices");
}

export async function incrementVapiMinutesUsage(
  supabase: SupabaseClient,
  businessId: string,
  minutes: number
): Promise<void> {
  if (minutes <= 0) {
    return;
  }

  await incrementCounter(
    supabase,
    businessId,
    "usage_vapi_minutes",
    Math.ceil(minutes)
  );
}

export async function recordSmartCollectSettlement(
  supabase: SupabaseClient,
  input: {
    businessId: string;
    amountInr: number;
    gatewayFeeInr?: number;
  }
): Promise<void> {
  const row = await fetchBusinessUsageMeteringRow(supabase, input.businessId);

  if (!row) {
    return;
  }

  const gatewayFeeInr = input.gatewayFeeInr ?? 0;

  const { error } = await supabase
    .from("businesses")
    .update({
      usage_smart_collect: row.usage_smart_collect + 1,
      total_volume_collected_inr:
        row.total_volume_collected_inr + input.amountInr,
      total_gateway_fees_inr: row.total_gateway_fees_inr + gatewayFeeInr,
    })
    .eq("id", input.businessId);

  if (error) {
    throw new Error(error.message || "Failed to record Smart Collect settlement.");
  }
}

export async function incrementSmsUsageSafely(
  supabase: SupabaseClient,
  businessId: string | null | undefined
): Promise<void> {
  if (!businessId) {
    return;
  }

  try {
    await incrementSmsUsage(supabase, businessId);
  } catch (error) {
    console.error("[usage-metering] SMS increment failed:", error);
  }
}

export async function incrementWhatsappUsageSafely(
  supabase: SupabaseClient,
  businessId: string | null | undefined
): Promise<void> {
  if (!businessId) {
    return;
  }

  try {
    await incrementWhatsappUsage(supabase, businessId);
  } catch (error) {
    console.error("[usage-metering] WhatsApp increment failed:", error);
  }
}

export async function incrementInvoiceUsageSafely(
  supabase: SupabaseClient,
  businessId: string | null | undefined
): Promise<void> {
  if (!businessId) {
    return;
  }

  try {
    await incrementInvoiceUsage(supabase, businessId);
  } catch (error) {
    console.error("[usage-metering] Invoice increment failed:", error);
  }
}

export async function incrementVapiMinutesUsageSafely(
  supabase: SupabaseClient,
  businessId: string | null | undefined,
  minutes: number
): Promise<void> {
  if (!businessId || minutes <= 0) {
    return;
  }

  try {
    await incrementVapiMinutesUsage(supabase, businessId, minutes);
  } catch (error) {
    console.error("[usage-metering] VAPI minutes increment failed:", error);
  }
}

export async function recordSmartCollectSettlementSafely(
  supabase: SupabaseClient,
  input: {
    businessId: string | null | undefined;
    amountInr: number;
    gatewayFeeInr?: number;
  }
): Promise<void> {
  if (!input.businessId) {
    return;
  }

  try {
    await recordSmartCollectSettlement(supabase, {
      businessId: input.businessId,
      amountInr: input.amountInr,
      gatewayFeeInr: input.gatewayFeeInr,
    });
  } catch (error) {
    console.error("[usage-metering] Smart Collect settlement record failed:", error);
  }
}
