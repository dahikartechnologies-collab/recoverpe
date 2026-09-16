import { SupabaseClient } from "@supabase/supabase-js";
import {
  computeDebtorHealthScore,
  medianOf,
} from "@/lib/debtor-health";
import { daysBetweenDateOnly, getTodayDateStringInIst } from "@/lib/timezone";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function refreshDebtorHealthScores(
  supabase: SupabaseClient,
  limit = 400
): Promise<number> {
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, user_id")
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to list contacts for DHS.");
  }

  let updated = 0;
  const today = getTodayDateStringInIst();
  const sinceIso = new Date(Date.now() - NINETY_DAYS_MS).toISOString();

  for (const contact of contacts ?? []) {
    const contactId = contact.id as string;
    const score = await scoreContact(supabase, contactId, today, sinceIso);

    const { error: updateError } = await supabase
      .from("contacts")
      .update({ debtor_health_score: score })
      .eq("id", contactId);

    if (!updateError) {
      updated += 1;
    }
  }

  return updated;
}

async function scoreContact(
  supabase: SupabaseClient,
  contactId: string,
  today: string,
  sinceIso: string
): Promise<number> {
  const { data: settled } = await supabase
    .from("ledgers")
    .select("created_at, due_date, status, balance_due")
    .eq("contact_id", contactId)
    .in("status", ["paid", "partially_paid"])
    .order("created_at", { ascending: false })
    .limit(12);

  const { data: openLedgers } = await supabase
    .from("ledgers")
    .select("due_date, balance_due, status")
    .eq("contact_id", contactId)
    .gt("balance_due", 0);

  const { data: promises } = await supabase
    .from("payment_promises")
    .select("status")
    .eq("contact_id", contactId)
    .in("status", ["kept", "broken"])
    .gte("promised_on", sinceIso.slice(0, 10));

  const { data: rejected } = await supabase
    .from("reconciliations")
    .select("id")
    .eq("contact_id", contactId)
    .eq("status", "rejected")
    .gte("created_at", sinceIso);

  const { data: logs } = await supabase
    .from("communication_logs")
    .select("direction, executed_at")
    .eq("contact_id", contactId)
    .eq("channel", "whatsapp")
    .order("executed_at", { ascending: true })
    .limit(200);

  const daysToPay = (settled ?? [])
    .map((ledger) => {
      const created = String(ledger.created_at ?? "").slice(0, 10);
      const due = String(ledger.due_date ?? created);
      return Math.max(0, daysBetweenDateOnly(created, due));
    })
    .filter((value) => Number.isFinite(value));

  const pastDue = (openLedgers ?? [])
    .map((ledger) =>
      Math.max(0, daysBetweenDateOnly(String(ledger.due_date), today))
    )
    .filter((value) => Number.isFinite(value));

  const replyHours: number[] = [];
  let lastOutbound: string | null = null;

  for (const log of logs ?? []) {
    if (log.direction === "outbound") {
      lastOutbound = log.executed_at as string;
    } else if (log.direction === "inbound" && lastOutbound) {
      const hours =
        (new Date(log.executed_at as string).getTime() -
          new Date(lastOutbound).getTime()) /
        3_600_000;
      if (hours >= 0) {
        replyHours.push(hours);
      }
      lastOutbound = null;
    }
  }

  const kept = (promises ?? []).filter((row) => row.status === "kept").length;
  const broken = (promises ?? []).filter((row) => row.status === "broken").length;

  return computeDebtorHealthScore({
    medianDaysToPay: medianOf(daysToPay),
    keptPromises: kept,
    brokenPromises: broken,
    rejectedProofs90d: rejected?.length ?? 0,
    medianReplyHours: medianOf(replyHours),
    avgDaysPastDue:
      pastDue.length === 0
        ? 0
        : pastDue.reduce((sum, value) => sum + value, 0) / pastDue.length,
  });
}
