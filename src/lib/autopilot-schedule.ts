import { Business, SubscriptionPlan } from "@/types";

export const FREE_AUTOPILOT_SCHEDULE = [0, 3, 5, 7] as const;

export const DEFAULT_AUTOPILOT_SCHEDULE: number[] = [...FREE_AUTOPILOT_SCHEDULE];

export type AutopilotTone = "polite" | "firm" | "critical";

export type CadenceRunStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "halted"
  | "failed";

export interface CadenceRun {
  id: string;
  ledger_id: string;
  step_index: number;
  next_run_at: string;
  status: CadenceRunStatus;
  created_at: string;
}

export interface AutopilotLedgerContext {
  id: string;
  user_id: string;
  contact_id: string;
  business_id: string | null;
  due_date: string;
  balance_due: number;
  status: string;
  communication_paused: boolean;
  communication_autopilot: boolean;
  legal_escalation_ready: boolean;
}

export interface AutopilotBusinessContext {
  id: string;
  business_name: string;
  autopilot_schedule: number[];
}

export function parseAutopilotSchedule(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_AUTOPILOT_SCHEDULE];
  }

  const parsed = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);

  if (parsed.length === 0) {
    return [...DEFAULT_AUTOPILOT_SCHEDULE];
  }

  return [...parsed].sort((left, right) => left - right);
}

export function resolveAutopilotSchedule(
  subscriptionPlan: SubscriptionPlan,
  business: Pick<Business, "autopilot_schedule"> | null
): number[] {
  if (subscriptionPlan === "free") {
    return [...FREE_AUTOPILOT_SCHEDULE];
  }

  if (!business) {
    return [...DEFAULT_AUTOPILOT_SCHEDULE];
  }

  return parseAutopilotSchedule(business.autopilot_schedule);
}

export function validatePremiumAutopilotSchedule(
  schedule: number[]
): { valid: true; schedule: number[] } | { valid: false; error: string } {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return { valid: false, error: "Autopilot schedule must contain at least one day." };
  }

  if (schedule.length > 8) {
    return { valid: false, error: "Autopilot schedule cannot exceed 8 steps." };
  }

  const normalized = [...schedule]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (normalized.length !== schedule.length) {
    return { valid: false, error: "Autopilot schedule must contain valid day numbers." };
  }

  for (const day of normalized) {
    if (!Number.isInteger(day) || day < 0 || day > 365) {
      return {
        valid: false,
        error: "Each schedule day must be an integer between 0 and 365.",
      };
    }
  }

  const sorted = [...normalized].sort((left, right) => left - right);
  const unique = new Set(sorted);

  if (unique.size !== sorted.length) {
    return { valid: false, error: "Autopilot schedule days must be unique." };
  }

  return { valid: true, schedule: sorted };
}

export function isMonetizationStep(
  stepIndex: number,
  schedule: number[]
): boolean {
  return stepIndex >= schedule.length;
}

export function resolveAutopilotTone(stepIndex: number): AutopilotTone {
  if (stepIndex <= 0) {
    return "polite";
  }

  if (stepIndex === 1) {
    return "firm";
  }

  return "critical";
}

export function formatAutopilotScheduleLabel(schedule: number[]): string {
  return schedule.map((day) => `Day ${day}`).join(", ");
}
