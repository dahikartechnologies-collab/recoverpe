export const AGENT_ONBOARD_PAYOUT_INR = 100;
export const AGENT_TRAIL_PAYOUT_INR = 50;
export const AGENT_MAX_DISCOUNT_BPS = 1200;
export const AGENT_DEFAULT_DISCOUNT_CAP_BPS = 1000;
export const AGENT_OTP_TTL_MS = 10 * 60 * 1000;
export const AGENT_OTP_MAX_ATTEMPTS = 5;
/** Five unremitted Premium tickets at ₹1,999. */
export const AGENT_LIABILITY_FREEZE_INR = 9_995;
export const AGENT_MAX_OPEN_CASH_TICKETS = 5;
export const AGENT_OTP_CANCEL_AFTER_MS = 24 * 60 * 60 * 1000;

export const AGENT_ACTIVE_STATUSES = ["pending_kyc", "active"] as const;
