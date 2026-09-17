import { AGENT_MAX_DISCOUNT_BPS } from "@/lib/agent/constants";
import { expectedPremiumInr } from "@/lib/agent/otp";

export const PREMIUM_LIST_PRICE_INR = 1999;

export const AGENT_DISCOUNT_OPTIONS = [
  { label: "0%", percent: 0, bps: 0 },
  { label: "5%", percent: 5, bps: 500 },
  { label: "10%", percent: 10, bps: 1000 },
  { label: "12%", percent: 12, bps: 1200 },
] as const;

export type AgentDiscountBps = (typeof AGENT_DISCOUNT_OPTIONS)[number]["bps"];

export function getAgentDiscountOptionsForCap(capBps: number) {
  return AGENT_DISCOUNT_OPTIONS.filter(
    (option) => option.bps <= capBps && option.bps <= AGENT_MAX_DISCOUNT_BPS
  );
}

export function isAllowedAgentDiscountBps(
  discountBps: number,
  capBps: number
): discountBps is AgentDiscountBps {
  return getAgentDiscountOptionsForCap(capBps).some(
    (option) => option.bps === discountBps
  );
}

export function formatExpectedCashCollection(discountBps: number): string {
  const amount = expectedPremiumInr(discountBps, PREMIUM_LIST_PRICE_INR);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function referralStatusLabel(status: string): string {
  switch (status) {
    case "awaiting_merchant_otp":
      return "Awaiting OTP";
    case "cash_held":
      return "Pending remittance";
    case "activated":
      return "Activated";
    case "cancelled":
      return "Cancelled";
    case "clawback":
      return "Clawback";
    case "draft":
      return "Draft";
    default:
      return status.replace(/_/g, " ");
  }
}

export function referralOnboardingStatus(status: string): string {
  switch (status) {
    case "draft":
      return "draft";
    case "awaiting_merchant_otp":
      return "awaiting_otp";
    case "activated":
    case "cash_held":
      return "active";
    case "cancelled":
      return "cancelled";
    case "clawback":
      return "clawback";
    default:
      return status;
  }
}

export function payoutKindLabel(kind: string): string {
  switch (kind) {
    case "onboard_100":
      return "Onboard commission";
    case "trail_50":
      return "Monthly trail";
    default:
      return kind.replace(/_/g, " ");
  }
}
