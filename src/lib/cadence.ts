import { daysBetweenDateOnly } from "@/lib/timezone";
import { SubscriptionPlan } from "@/types";

export type ReminderCadence =
  | "3_days_before"
  | "due_today"
  | "3_days_overdue"
  | "7_days_overdue"
  | "15_days_overdue"
  | "30_days_overdue"
  | "60_days_overdue"
  | "90_days_overdue";

const FREE_PLAN_CADENCE_DELTAS = new Set([0, 3, 7]);

const PREMIUM_PLAN_CADENCE_DELTAS: Array<{
  delta: number;
  cadence: ReminderCadence;
}> = [
  { delta: -3, cadence: "3_days_before" },
  { delta: 0, cadence: "due_today" },
  { delta: 3, cadence: "3_days_overdue" },
  { delta: 7, cadence: "7_days_overdue" },
  { delta: 15, cadence: "15_days_overdue" },
  { delta: 30, cadence: "30_days_overdue" },
  { delta: 60, cadence: "60_days_overdue" },
  { delta: 90, cadence: "90_days_overdue" },
];

export function resolveReminderCadence(
  dueDate: string,
  referenceDate: string,
  subscriptionPlan: SubscriptionPlan
): ReminderCadence | null {
  const delta = daysBetweenDateOnly(dueDate, referenceDate);

  if (subscriptionPlan === "free") {
    if (delta === 0) {
      return "due_today";
    }

    if (delta === 3) {
      return "3_days_overdue";
    }

    if (delta === 7) {
      return "7_days_overdue";
    }

    return null;
  }

  const match = PREMIUM_PLAN_CADENCE_DELTAS.find((entry) => entry.delta === delta);
  return match?.cadence ?? null;
}

export function isFreePlanCadenceDay(
  dueDate: string,
  referenceDate: string
): boolean {
  const delta = daysBetweenDateOnly(dueDate, referenceDate);
  return FREE_PLAN_CADENCE_DELTAS.has(delta);
}
