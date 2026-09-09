-- Sprint 16: Dashboard RPCs, user UPI VPA, payment verification proofs
-- Run in Supabase SQL Editor (Dashboard > SQL) in order after 001–007.

-- ---------------------------------------------------------------------------
-- User profile: default UPI VPA for pay links & invoices
-- ---------------------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_upi_vpa TEXT;

COMMENT ON COLUMN users.default_upi_vpa IS
  'Merchant UPI VPA for pay links and invoice QR codes; overrides env fallback when set.';

-- ---------------------------------------------------------------------------
-- Payment screenshot verifications (debtor-submitted proofs)
-- ---------------------------------------------------------------------------

CREATE TYPE payment_verification_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TABLE IF NOT EXISTS payment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id UUID NOT NULL REFERENCES ledgers (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  screenshot_url TEXT NOT NULL,
  claimed_amount NUMERIC(12, 2),
  status payment_verification_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_verifications_user_status
  ON payment_verifications (user_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_verifications_ledger_id
  ON payment_verifications (ledger_id);

-- ---------------------------------------------------------------------------
-- RPC: get_dashboard_metrics
-- Calculates Total Outstanding, Severely Overdue, and Recovered in PostgreSQL.
-- p_workspace_mode: 'personal' | 'business'
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_user_id UUID,
  p_workspace_mode TEXT,
  p_business_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_outstanding NUMERIC,
  severely_overdue NUMERIC,
  recovered_via_recoverpe NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH scoped_ledgers AS (
    SELECT l.id, l.balance_due, l.due_date, l.status
    FROM ledgers l
    WHERE l.user_id = p_user_id
      AND (
        (p_workspace_mode = 'personal' AND l.business_id IS NULL)
        OR (p_workspace_mode = 'business' AND l.business_id = p_business_id)
      )
  ),
  today AS (
    SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE AS d
  )
  SELECT
    COALESCE(SUM(sl.balance_due) FILTER (
      WHERE sl.balance_due > 0
        AND sl.status NOT IN ('paid', 'cancelled', 'refunded')
    ), 0)::NUMERIC AS total_outstanding,
    COALESCE(SUM(sl.balance_due) FILTER (
      WHERE sl.balance_due > 0
        AND sl.due_date < (SELECT d FROM today)
    ), 0)::NUMERIC AS severely_overdue,
    COALESCE((
      SELECT SUM(t.amount)
      FROM transactions t
      WHERE t.transaction_type = 'payment_received'
        AND t.ledger_id IN (SELECT id FROM scoped_ledgers)
    ), 0)::NUMERIC AS recovered_via_recoverpe
  FROM scoped_ledgers sl;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_wall_of_shame
-- Top debtors by balance (highest first), then longest overdue (earliest due date).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_wall_of_shame(
  p_user_id UUID,
  p_workspace_mode TEXT,
  p_business_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  ledger_id UUID,
  contact_name TEXT,
  balance_due NUMERIC,
  due_date DATE,
  days_overdue INT
)
LANGUAGE sql
STABLE
AS $$
  WITH today AS (
    SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE AS d
  )
  SELECT
    l.id AS ledger_id,
    c.name AS contact_name,
    l.balance_due,
    l.due_date,
    GREATEST(0, ((SELECT d FROM today) - l.due_date))::INT AS days_overdue
  FROM ledgers l
  INNER JOIN contacts c ON c.id = l.contact_id
  WHERE l.user_id = p_user_id
    AND l.balance_due > 0
    AND l.status NOT IN ('paid', 'cancelled', 'refunded')
    AND (
      (p_workspace_mode = 'personal' AND l.business_id IS NULL)
      OR (p_workspace_mode = 'business' AND l.business_id = p_business_id)
    )
  ORDER BY l.balance_due DESC, l.due_date ASC
  LIMIT GREATEST(1, LEAST(p_limit, 20));
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_wall_of_shame(UUID, TEXT, UUID, INT) TO service_role;
