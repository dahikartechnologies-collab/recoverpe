-- Sprint 59: 3-tier SaaS, Razorpay Route payout, omnichannel metadata.

ALTER TYPE business_subscription_tier ADD VALUE IF NOT EXISTS 'starter';
ALTER TYPE business_subscription_tier ADD VALUE IF NOT EXISTS 'business';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_interval TEXT
    CHECK (subscription_interval IS NULL OR subscription_interval IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'active', 'past_due', 'cancelled')),
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_pan TEXT,
  ADD COLUMN IF NOT EXISTS payout_bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payout_bank_ifsc TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_linked_account_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_route_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE inbound_payments
  ADD COLUMN IF NOT EXISTS route_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS route_transfer_status TEXT;

COMMENT ON COLUMN businesses.subscription_interval IS
  'Billing cadence for the active RecoverPe SaaS subscription.';
COMMENT ON COLUMN businesses.razorpay_route_status IS
  'Razorpay Route linked-account lifecycle: pending, active, needs_clarification, suspended.';
COMMENT ON COLUMN contacts.sms_opt_out IS
  'Debtor opted out of transactional SMS reminders.';
COMMENT ON COLUMN contacts.email_opt_out IS
  'Debtor opted out of transactional email reminders.';

CREATE INDEX IF NOT EXISTS businesses_route_status_idx
  ON businesses (razorpay_route_status)
  WHERE razorpay_route_status <> 'active';
