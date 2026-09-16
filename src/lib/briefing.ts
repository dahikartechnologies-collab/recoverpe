import { SupabaseClient } from "@supabase/supabase-js";
import {
  BriefingBullet,
  BriefingMetrics,
  DailyBriefing,
} from "@/lib/briefing-types";
import { formatCurrency } from "@/lib/gst";
import { getTodayDateStringInIst } from "@/lib/timezone";

export type { BriefingBullet, BriefingMetrics, DailyBriefing };

export function buildRuleBasedBriefing(
  metrics: BriefingMetrics,
  briefingDate: string
): DailyBriefing {
  const bullets: BriefingBullet[] = [];

  bullets.push({
    label: "Collected",
    detail: `Recovered ${formatCurrency(metrics.collected_inr)} in the last 26 hours.`,
    tone: metrics.collected_inr > 0 ? "success" : "neutral",
  });

  if (metrics.proofs_pending > 0) {
    bullets.push({
      label: "Proofs",
      detail: `${metrics.proofs_pending} payment screenshot${metrics.proofs_pending === 1 ? "" : "s"} waiting in Settlement Desk.`,
      tone: "warning",
    });
  }

  if (metrics.promises_broken > 0) {
    bullets.push({
      label: "Broken promises",
      detail: `${metrics.promises_broken} “kal bhej dunga” date${metrics.promises_broken === 1 ? "" : "s"} slipped overnight.`,
      tone: "danger",
    });
  }

  if (metrics.whatsapp_failed > 0) {
    bullets.push({
      label: "WhatsApp",
      detail: `${metrics.whatsapp_failed} reminder${metrics.whatsapp_failed === 1 ? "" : "s"} failed to deliver.`,
      tone: "warning",
    });
  }

  if (bullets.length === 1) {
    bullets.push({
      label: "Inbox",
      detail: "No proofs, broken promises, or failed WhatsApp overnight. Use the inbox if a debtor writes in.",
      tone: "neutral",
    });
  }

  const headline =
    metrics.collected_inr > 0
      ? `${formatCurrency(metrics.collected_inr)} landed overnight.`
      : "Quiet night — chase the inbox before 11am.";

  return {
    headline,
    bullets,
    metrics,
    model: "rule-based",
    briefing_date: briefingDate,
  };
}

export async function generateDailyBriefings(
  supabase: SupabaseClient
): Promise<number> {
  const briefingDate = getTodayDateStringInIst();
  const sinceIso = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id, user_id, subscription_tier")
    .limit(200);

  if (error) {
    throw new Error(error.message || "Failed to list businesses for briefing.");
  }

  let generated = 0;

  for (const business of businesses ?? []) {
    const businessId = business.id as string;
    const userId = business.user_id as string;

    const [collected, proofs, promises, failed] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount, logged_at, ledgers!inner(user_id, business_id)")
        .eq("transaction_type", "payment_received")
        .eq("ledgers.user_id", userId)
        .eq("ledgers.business_id", businessId)
        .gte("logged_at", sinceIso),
      supabase
        .from("reconciliations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("business_id", businessId)
        .eq("status", "pending_review"),
      supabase
        .from("payment_promises")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("business_id", businessId)
        .eq("status", "broken")
        .gte("promised_on", sinceIso.slice(0, 10)),
      supabase
        .from("communication_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("business_id", businessId)
        .eq("channel", "whatsapp")
        .eq("status", "failed")
        .gte("executed_at", sinceIso),
    ]);

    const collectedInr = (collected.data ?? []).reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0
    );

    const metrics: BriefingMetrics = {
      collected_inr: collectedInr,
      proofs_pending: proofs.count ?? 0,
      promises_broken: promises.count ?? 0,
      whatsapp_failed: failed.count ?? 0,
    };

    const briefing = buildRuleBasedBriefing(metrics, briefingDate);

    const { error: upsertError } = await supabase.from("daily_briefings").upsert(
      {
        user_id: userId,
        business_id: businessId,
        briefing_date: briefingDate,
        headline: briefing.headline,
        bullets: briefing.bullets,
        metrics: briefing.metrics,
        model: briefing.model,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,business_id,briefing_date" }
    );

    if (!upsertError) {
      generated += 1;
    }
  }

  return generated;
}

export async function fetchLatestBriefing(
  supabase: SupabaseClient,
  userId: string,
  businessId: string | null
): Promise<DailyBriefing | null> {
  if (!businessId) {
    return null;
  }

  const { data, error } = await supabase
    .from("daily_briefings")
    .select("headline, bullets, metrics, model, briefing_date")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .order("briefing_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    headline: data.headline as string,
    bullets: (data.bullets as BriefingBullet[]) ?? [],
    metrics: data.metrics as BriefingMetrics,
    model: (data.model as string) ?? "rule-based",
    briefing_date: data.briefing_date as string,
  };
}
