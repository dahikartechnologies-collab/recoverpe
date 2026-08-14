import { fetchSuspendedUserIds } from "@/lib/admin-users";
import { SupabaseClient } from "@supabase/supabase-js";

export type ReminderCadence =
  | "3_days_before"
  | "due_today"
  | "15_days_overdue";

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
  contacts: { name: string; phone_number: string } | { name: string; phone_number: string }[] | null;
};

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysFromDueDate(dueDate: string, referenceDate: string): number {
  const due = parseDateOnly(dueDate);
  const today = parseDateOnly(referenceDate);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.round((today.getTime() - due.getTime()) / millisecondsPerDay);
}

export function resolveReminderCadence(
  dueDate: string,
  referenceDate: string
): ReminderCadence | null {
  const delta = daysFromDueDate(dueDate, referenceDate);

  if (delta === -3) {
    return "3_days_before";
  }

  if (delta === 0) {
    return "due_today";
  }

  if (delta === 15) {
    return "15_days_overdue";
  }

  return null;
}

export async function fetchCronReminderTargets(
  supabase: SupabaseClient,
  referenceDate: string = new Date().toISOString().slice(0, 10)
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

    const cadence = resolveReminderCadence(row.due_date, referenceDate);

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
      days_from_due: daysFromDueDate(row.due_date, referenceDate),
      contact_name: contactData?.name ?? "Unknown",
      contact_phone: contactData?.phone_number ?? "",
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
