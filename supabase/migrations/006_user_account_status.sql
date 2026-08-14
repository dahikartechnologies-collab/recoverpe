-- Sprint 12 Phase B: User account status and discount eligibility

CREATE TYPE account_status AS ENUM ('active', 'suspended', 'pending_purge');

ALTER TABLE users
ADD COLUMN IF NOT EXISTS account_status account_status NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS eligible_for_discount BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_account_status ON users (account_status);
CREATE INDEX IF NOT EXISTS idx_users_eligible_for_discount
ON users (eligible_for_discount)
WHERE eligible_for_discount = TRUE;

COMMENT ON COLUMN users.account_status IS
  'Platform access state: active, suspended (ban hammer), or pending_purge';
COMMENT ON COLUMN users.eligible_for_discount IS
  'When true, user is eligible for server-side upsell discounts (e.g. 50% Premium)';
