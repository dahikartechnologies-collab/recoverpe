export interface DebtorHealthInputs {
  medianDaysToPay: number | null;
  keptPromises: number;
  brokenPromises: number;
  rejectedProofs90d: number;
  medianReplyHours: number | null;
  avgDaysPastDue: number;
}

export type DebtorHealthTier = "reliable" | "watch" | "chase" | "cash_only";

function clip(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeDebtorHealthScore(input: DebtorHealthInputs): number {
  const velocity =
    input.medianDaysToPay === null
      ? 17
      : clip(35 * (1 - input.medianDaysToPay / 45), 0, 35);

  const promiseTotal = input.keptPromises + input.brokenPromises;
  const promiseKeep =
    promiseTotal === 0
      ? 10
      : clip(20 * (input.keptPromises / promiseTotal), 0, 20);

  const dispute = clip(15 - 5 * input.rejectedProofs90d, 0, 15);

  let response = 0;
  if (input.medianReplyHours !== null) {
    if (input.medianReplyHours <= 2) {
      response = 15;
    } else if (input.medianReplyHours >= 72) {
      response = 0;
    } else {
      response = clip(15 * (1 - (input.medianReplyHours - 2) / 70), 0, 15);
    }
  }

  const aging = clip(15 - Math.min(15, input.avgDaysPastDue / 4), 0, 15);

  return Math.round(clip(velocity + promiseKeep + dispute + response + aging, 0, 100));
}

export function debtorHealthTier(score: number): DebtorHealthTier {
  if (score >= 80) {
    return "reliable";
  }
  if (score >= 60) {
    return "watch";
  }
  if (score >= 40) {
    return "chase";
  }
  return "cash_only";
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

export function medianOf(values: number[]): number | null {
  return median(values);
}
