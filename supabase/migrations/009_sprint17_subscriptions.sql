-- Sprint 17: Recurring subscriptions, premium expiry, recovery upsell tracking
-- Run in Supabase SQL Editor after migrations 001–008.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_upsell_shown BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.premium_expires_at IS
  'When the current Premium subscription period ends (renewed via Razorpay webhooks).';

COMMENT ON COLUMN users.recovery_upsell_shown IS
  'True after the ₹50,000 recovery milestone upsell modal has been displayed.';

CREATE TABLE IF NOT EXISTS razorpay_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  razorpay_subscription_id TEXT NOT NULL UNIQUE,
  purchase_type TEXT NOT NULL,
  plan_interval TEXT NOT NULL CHECK (plan_interval IN ('monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'created',
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_razorpay_subscriptions_user_id
  ON razorpay_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_razorpay_subscriptions_status
  ON razorpay_subscriptions (status);

COMMENT ON TABLE razorpay_subscriptions IS
  'Tracks Razorpay recurring Premium subscriptions for webhook renewal/cancellation.';

-- Extend razorpay_orders purchase_type to allow micro-transactions (no enum constraint on TEXT).
