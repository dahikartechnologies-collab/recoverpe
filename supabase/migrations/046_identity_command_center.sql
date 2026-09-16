-- Wave 1–2: identity switcher, RecoverPe Field Agent network, command center.
--
-- Cash protocol is OPTION A (founder sign-off 16 Sep 2026): merchant WhatsApp
-- OTP activates Premium immediately. wallet_liability_inr still tracks
-- unremitted cash. Five open tickets freeze new referrals.
-- Books Close was killed — do not add a books_close SKU here.

-- ---------------------------------------------------------------------------
-- Contacts: owner take-over + cheap DHS list column
-- ---------------------------------------------------------------------------
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS bot_paused BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS debtor_health_score INT;

COMMENT ON COLUMN contacts.bot_paused IS
  'Owner paused inbound Gemini and autopilot for this debtor. Ledger communication_paused remains for a single invoice.';

COMMENT ON COLUMN contacts.debtor_health_score IS
  '0–100, high = pays. Inverse polarity of risk_score. Nightly job in daily-runner.';

CREATE INDEX IF NOT EXISTS contacts_bot_paused_idx
  ON contacts (user_id)
  WHERE bot_paused = TRUE;

-- ---------------------------------------------------------------------------
-- Promise Register foundation (SKU ships in a later wave; DHS reads this table)
-- ---------------------------------------------------------------------------
CREATE TYPE promise_source AS ENUM ('inbound', 'owner');
CREATE TYPE promise_status AS ENUM ('open', 'kept', 'broken', 'void');

CREATE TABLE payment_promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  ledger_id UUID REFERENCES ledgers(id) ON DELETE SET NULL,
  promised_on DATE NOT NULL,
  promised_amount NUMERIC(12,2) NOT NULL CHECK (promised_amount >= 0),
  source promise_source NOT NULL DEFAULT 'inbound',
  status promise_status NOT NULL DEFAULT 'open',
  communication_log_id UUID REFERENCES communication_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payment_promises_contact_status_idx
  ON payment_promises (contact_id, status, promised_on);

ALTER TABLE payment_promises ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_promises_select ON payment_promises
  FOR SELECT USING (can_manage_workspace(payment_promises.user_id));

CREATE POLICY payment_promises_insert ON payment_promises
  FOR INSERT WITH CHECK (can_manage_workspace(payment_promises.user_id));

CREATE POLICY payment_promises_update ON payment_promises
  FOR UPDATE
  USING (can_manage_workspace(payment_promises.user_id))
  WITH CHECK (can_manage_workspace(payment_promises.user_id));

-- ---------------------------------------------------------------------------
-- Morning briefing cache
-- ---------------------------------------------------------------------------
CREATE TABLE daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  headline TEXT NOT NULL,
  bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, business_id, briefing_date)
);

CREATE INDEX daily_briefings_business_date_idx
  ON daily_briefings (business_id, briefing_date DESC);

ALTER TABLE daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_briefings_select ON daily_briefings
  FOR SELECT USING (can_manage_workspace(daily_briefings.user_id));

-- ---------------------------------------------------------------------------
-- Field Agent network (NOT workspace_members.field_staff)
-- ---------------------------------------------------------------------------
CREATE TYPE agent_status AS ENUM ('pending_kyc', 'active', 'suspended', 'offboarded');
CREATE TYPE referral_status AS ENUM (
  'draft',
  'awaiting_merchant_otp',
  'cash_held',
  'activated',
  'cancelled',
  'clawback'
);
CREATE TYPE payout_status AS ENUM ('accrued', 'approved', 'paid', 'held', 'reversed');
CREATE TYPE cash_status AS ENUM (
  'declared',
  'merchant_confirmed',
  'remitted',
  'short',
  'disputed'
);

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  status agent_status NOT NULL DEFAULT 'pending_kyc',
  referral_code TEXT NOT NULL UNIQUE,
  discount_cap_bps INT NOT NULL DEFAULT 1000
    CHECK (discount_cap_bps >= 0 AND discount_cap_bps <= 1200),
  wallet_liability_inr NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  merchant_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  merchant_phone TEXT NOT NULL,
  business_name TEXT,
  discount_bps INT NOT NULL DEFAULT 0
    CHECK (discount_bps >= 0 AND discount_bps <= 1200),
  premium_plan TEXT NOT NULL DEFAULT 'subscription_premium',
  status referral_status NOT NULL DEFAULT 'draft',
  merchant_otp_hash TEXT,
  merchant_otp_expires_at TIMESTAMPTZ,
  merchant_otp_attempts INT NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ,
  razorpay_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX agent_referrals_open_phone
  ON agent_referrals (merchant_phone)
  WHERE status IN ('draft', 'awaiting_merchant_otp', 'cash_held');

CREATE INDEX agent_referrals_agent_idx ON agent_referrals (agent_id, created_at DESC);

CREATE TABLE agent_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES agent_referrals(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('onboard_100', 'trail_50')),
  amount_inr NUMERIC(12,2) NOT NULL,
  period_ym CHAR(7),
  status payout_status NOT NULL DEFAULT 'accrued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX agent_payouts_onboard_once
  ON agent_payouts (referral_id)
  WHERE kind = 'onboard_100';

CREATE UNIQUE INDEX agent_payouts_trail_month
  ON agent_payouts (referral_id, period_ym)
  WHERE kind = 'trail_50';

CREATE TABLE agent_cash_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES agent_referrals(id) ON DELETE CASCADE,
  declared_inr NUMERIC(12,2) NOT NULL,
  expected_inr NUMERIC(12,2) NOT NULL,
  status cash_status NOT NULL DEFAULT 'declared',
  merchant_confirmed_at TIMESTAMPTZ,
  remitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX agent_cash_open_idx
  ON agent_cash_collections (agent_id)
  WHERE status IN ('declared', 'merchant_confirmed');

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_cash_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_select_own ON agents
  FOR SELECT USING (user_id = auth_user_id());

CREATE POLICY agent_referrals_select_own ON agent_referrals
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth_user_id())
  );

CREATE POLICY agent_payouts_select_own ON agent_payouts
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth_user_id())
  );

CREATE POLICY agent_cash_select_own ON agent_cash_collections
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth_user_id())
  );

-- Inbox lookup: last WhatsApp per contact for a workspace.
CREATE INDEX IF NOT EXISTS communication_logs_whatsapp_inbox_idx
  ON communication_logs (user_id, contact_id, executed_at DESC)
  WHERE channel = 'whatsapp';
