import { AGENT_MAX_DISCOUNT_BPS } from "@/lib/agent/constants";

export function formatDiscountCapBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}% Max Discount`;
}

export function discountPercentToBps(percent: number): number {
  return Math.min(
    AGENT_MAX_DISCOUNT_BPS,
    Math.max(0, Math.round(percent * 100))
  );
}

export function discountBpsToPercent(bps: number): number {
  return bps / 100;
}
