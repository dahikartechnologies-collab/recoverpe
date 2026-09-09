import { ReminderCadence, resolveReminderCadence } from "@/lib/cadence";
import { fetchSuspendedUserIds } from "@/lib/admin-users";
import { daysBetweenDateOnly, getTodayDateStringInIst } from "@/lib/timezone";
import { SubscriptionPlan } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

export type { ReminderCadence };

export interface CronLedgerTarget {
  ledger_id: string;
  user_id: string;
  contact_id: string;
  business_id: string | null;
  due_date: string;
  balance_due: number;
  status: string;
  communication_paused: boolean;
  cadence: ReminderCadence;
  days_from_due: number;
  contact_name: string;
  contact_phone: string;
  subscription_plan: SubscriptionPlan;
}

type RawCronLedgerRow = {
  id: string;
  user_id: string;
  contact_id: string;
  business_id: string | null;
  due_date: string;
  balance_due: number;
  status: string;
  communication_paused: boolean;
  contacts:
    | { name: string; phone_number: string }
    | { name: string; phone_number: string }[]
    | null;
  users:
    | { subscription_plan: SubscriptionPlan }
    | { subscription_plan: SubscriptionPlan }[]
    | null;
};

export async function fetchCronReminderTargets(
  supabase: SupabaseClient,
  referenceDate: string = getTodayDateStringInIst()
): Promise<CronLedgerTarget[]> {
  const { data, error } = await supabase
    .from("ledgers")
    .select(
      `
      id,
      user_id,
      contact_id,
      business_id,
      due_date,
      balance_due,
      status,
      communication_paused,
      contacts (
        name,
        phone_number
      ),
      users (
        subscription_plan
      )
    `
    )
    .gt("balance_due", 0)
    .neq("status", "cancelled")
    .eq("communication_paused", false);

  if (error) {
    throw new Error(error.message || "Failed to run cron master query.");
  }

  const suspendedUserIds = await fetchSuspendedUserIds(supabase);
  const targets: CronLedgerTarget[] = [];

  for (const row of (data ?? []) as RawCronLedgerRow[]) {
    if (suspendedUserIds.has(row.user_id)) {
      continue;
    }

    const userData = Array.isArray(row.users) ? row.users[0] : row.users;
    const subscriptionPlan =
      (userData?.subscription_plan as SubscriptionPlan | undefined) ?? "free";

    const cadence = resolveReminderCadence(
      row.due_date,
      referenceDate,
      subscriptionPlan
    );

    if (!cadence) {
      continue;
    }

    const contactData = Array.isArray(row.contacts)
      ? row.contacts[0]
      : row.contacts;

    targets.push({
      ledger_id: row.id,
      user_id: row.user_id,
      contact_id: row.contact_id,
      business_id: row.business_id,
      due_date: row.due_date,
      balance_due: Number(row.balance_due),
      status: row.status,
      communication_paused: row.communication_paused,
      cadence,
      days_from_due: daysBetweenDateOnly(row.due_date, referenceDate),
      contact_name: contactData?.name ?? "Unknown",
      contact_phone: contactData?.phone_number ?? "",
      subscription_plan: subscriptionPlan,
    });
  }

  return targets;
}

export function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const headerSecret = request.headers.get("x-cron-secret");
  const authorization = request.headers.get("authorization");

  if (headerSecret && headerSecret === cronSecret) {
    return true;
  }

  if (authorization === `Bearer ${cronSecret}`) {
    return true;
  }

  return false;
}
