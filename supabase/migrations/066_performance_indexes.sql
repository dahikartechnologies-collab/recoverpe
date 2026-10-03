-- Sprint 102: Performance indexes and database-level dashboard aggregation.
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction. Supabase CLI
-- wraps each migration in a transaction, so these use CREATE INDEX IF NOT
-- EXISTS (same as 034). When applying by hand outside a transaction, prefer:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS ...
--
-- communication_logs uses executed_at as its created timestamp.

-- ---------------------------------------------------------------------------
-- Foreign-key and filter indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_ledgers_business_id
  ON ledgers (business_id);

CREATE INDEX IF NOT EXISTS idx_communication_logs_business_id
  ON communication_logs (business_id);

CREATE INDEX IF NOT EXISTS idx_purchase_vouchers_business_id
  ON purchase_vouchers (business_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_business_id
  ON stock_movements (business_id);

CREATE INDEX IF NOT EXISTS idx_communication_logs_status
  ON communication_logs (status);

CREATE INDEX IF NOT EXISTS idx_communication_logs_created_at
  ON communication_logs (executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_communication_logs_status_created_at
  ON communication_logs (status, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_communication_logs_recipient_phone
  ON communication_logs (recipient_phone);

CREATE INDEX IF NOT EXISTS idx_communication_logs_business_executed
  ON communication_logs (business_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_captures_status
  ON document_captures (status);

CREATE INDEX IF NOT EXISTS idx_document_captures_created_at
  ON document_captures (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_captures_status_created_at
  ON document_captures (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbound_payments_business_id
  ON inbound_payments (business_id);

CREATE INDEX IF NOT EXISTS idx_inbound_payments_business_received
  ON inbound_payments (business_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledgers_business_created_at
  ON ledgers (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledgers_user_business_status
  ON ledgers (user_id, business_id, status);

CREATE INDEX IF NOT EXISTS idx_transactions_type_logged_at
  ON transactions (transaction_type, logged_at DESC);

-- ---------------------------------------------------------------------------
-- RPC: get_dashboard_metrics (add assigned-to filter, keep 3-arg callers)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS get_dashboard_metrics(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_user_id UUID,
  p_workspace_mode TEXT,
  p_business_id UUID DEFAULT NULL,
  p_assigned_to_user_id UUID DEFAULT NULL
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
        OR (p_workspace_mode = 'business' AND p_business_id IS NOT NULL AND l.business_id = p_business_id)
      )
      AND (p_assigned_to_user_id IS NULL OR l.assigned_to_user_id = p_assigned_to_user_id)
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
        AND sl.status NOT IN ('paid', 'cancelled', 'refunded')
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
-- RPC: get_dashboard_analytics_summary
-- Aggregates outstanding, collections, aging, cash flow, and sankey in Postgres.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_dashboard_analytics_summary(
  p_user_id UUID,
  p_workspace_mode TEXT,
  p_business_id UUID DEFAULT NULL,
  p_assigned_to_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH today AS (
    SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE AS d
  ),
  month_keys AS (
    SELECT to_char(
      date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')) - (gs.n || ' months')::interval,
      'YYYY-MM'
    ) AS month_key
    FROM generate_series(11, 0, -1) AS gs(n)
  ),
  scoped_ledgers AS (
    SELECT
      l.id,
      l.contact_id,
      l.total_amount,
      l.balance_due,
      l.due_date,
      l.status,
      l.created_at,
      l.legal_notice_pdf_url,
      l.samadhaan_docket_pdf_url,
      to_char(timezone('Asia/Kolkata', l.created_at), 'YYYY-MM') AS created_month_key
    FROM ledgers l
    WHERE l.user_id = p_user_id
      AND (
        (p_workspace_mode = 'personal' AND l.business_id IS NULL)
        OR (p_workspace_mode = 'business' AND p_business_id IS NOT NULL AND l.business_id = p_business_id)
      )
      AND (p_assigned_to_user_id IS NULL OR l.assigned_to_user_id = p_assigned_to_user_id)
  ),
  active_open AS (
    SELECT *
    FROM scoped_ledgers
    WHERE balance_due > 0
      AND status NOT IN ('paid', 'cancelled', 'refunded')
  ),
  payments AS (
    SELECT
      t.ledger_id,
      t.amount,
      t.logged_at,
      to_char(timezone('Asia/Kolkata', t.logged_at), 'YYYY-MM') AS paid_month_key
    FROM transactions t
    WHERE t.transaction_type = 'payment_received'
      AND t.ledger_id IN (SELECT id FROM scoped_ledgers)
  ),
  current_month AS (
    SELECT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month_key
  ),
  previous_month AS (
    SELECT to_char(
      date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')) - interval '1 month',
      'YYYY-MM'
    ) AS month_key
  ),
  summary AS (
    SELECT
      COALESCE((SELECT SUM(balance_due) FROM active_open), 0) AS total_outstanding,
      COALESCE((
        SELECT SUM(amount) FROM payments p, current_month cm
        WHERE p.paid_month_key = cm.month_key
      ), 0) AS collected_this_month,
      COALESCE((
        SELECT COUNT(DISTINCT contact_id)
        FROM active_open
        WHERE due_date < (SELECT d FROM today)
      ), 0) AS active_defaulters,
      COALESCE((
        SELECT SUM(total_amount) FROM scoped_ledgers sl, current_month cm
        WHERE sl.created_month_key = cm.month_key
      ), 0) AS expected_this_month,
      COALESCE((
        SELECT SUM(amount) FROM payments p, previous_month pm
        WHERE p.paid_month_key = pm.month_key
      ), 0) AS collected_previous_month,
      COALESCE((
        SELECT SUM(total_amount) FROM scoped_ledgers sl, previous_month pm
        WHERE sl.created_month_key = pm.month_key
      ), 0) AS expected_previous_month
  ),
  aging AS (
    SELECT
      COALESCE(SUM(balance_due) FILTER (
        WHERE GREATEST(0, (SELECT d FROM today) - due_date) <= 30
      ), 0) AS aging_0_30,
      COALESCE(SUM(balance_due) FILTER (
        WHERE GREATEST(0, (SELECT d FROM today) - due_date) BETWEEN 31 AND 60
      ), 0) AS aging_31_60,
      COALESCE(SUM(balance_due) FILTER (
        WHERE GREATEST(0, (SELECT d FROM today) - due_date) >= 61
      ), 0) AS aging_61_plus
    FROM active_open
  ),
  expected_by_month AS (
    SELECT mk.month_key, COALESCE(SUM(sl.total_amount), 0) AS expected
    FROM month_keys mk
    LEFT JOIN scoped_ledgers sl ON sl.created_month_key = mk.month_key
    GROUP BY mk.month_key
  ),
  collected_by_month AS (
    SELECT mk.month_key, COALESCE(SUM(p.amount), 0) AS collected
    FROM month_keys mk
    LEFT JOIN payments p ON p.paid_month_key = mk.month_key
    GROUP BY mk.month_key
  ),
  cash_flow AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'month_key', e.month_key,
          'expected', e.expected,
          'collected', c.collected
        )
        ORDER BY e.month_key
      ) AS points
    FROM expected_by_month e
    JOIN collected_by_month c ON c.month_key = e.month_key
  ),
  sankey AS (
    SELECT
      COALESCE(SUM(GREATEST(0, total_amount - balance_due)) FILTER (
        WHERE status NOT IN ('paid', 'cancelled', 'refunded')
      ), 0) AS collected_on_time,
      COALESCE(SUM(balance_due) FILTER (
        WHERE status NOT IN ('paid', 'cancelled', 'refunded')
          AND balance_due > 0
          AND GREATEST(0, (SELECT d FROM today) - due_date) <= 30
      ), 0) AS bucket_0_30,
      COALESCE(SUM(balance_due) FILTER (
        WHERE status NOT IN ('paid', 'cancelled', 'refunded')
          AND balance_due > 0
          AND GREATEST(0, (SELECT d FROM today) - due_date) BETWEEN 31 AND 60
      ), 0) AS bucket_31_60,
      COALESCE(SUM(balance_due) FILTER (
        WHERE status NOT IN ('paid', 'cancelled', 'refunded')
          AND balance_due > 0
          AND GREATEST(0, (SELECT d FROM today) - due_date) >= 61
      ), 0) AS bucket_60_plus,
      COALESCE(SUM(balance_due) FILTER (
        WHERE status NOT IN ('paid', 'cancelled', 'refunded')
          AND balance_due > 0
          AND GREATEST(0, (SELECT d FROM today) - due_date) >= 61
          AND (legal_notice_pdf_url IS NOT NULL OR samadhaan_docket_pdf_url IS NOT NULL)
      ), 0) AS legal_samadhaan,
      COALESCE(SUM(balance_due) FILTER (
        WHERE status NOT IN ('paid', 'cancelled', 'refunded')
          AND balance_due > 0
          AND GREATEST(0, (SELECT d FROM today) - due_date) >= 61
          AND legal_notice_pdf_url IS NULL
          AND samadhaan_docket_pdf_url IS NULL
      ), 0) AS unrecovered
    FROM scoped_ledgers
  )
  SELECT jsonb_build_object(
    'total_outstanding', (SELECT total_outstanding FROM summary),
    'collected_this_month', (SELECT collected_this_month FROM summary),
    'active_defaulters', (SELECT active_defaulters FROM summary),
    'expected_this_month', (SELECT expected_this_month FROM summary),
    'collected_previous_month', (SELECT collected_previous_month FROM summary),
    'expected_previous_month', (SELECT expected_previous_month FROM summary),
    'aging', jsonb_build_object(
      '0-30', (SELECT aging_0_30 FROM aging),
      '31-60', (SELECT aging_31_60 FROM aging),
      '61+', (SELECT aging_61_plus FROM aging)
    ),
    'cash_flow', COALESCE((SELECT points FROM cash_flow), '[]'::jsonb),
    'sankey', jsonb_build_object(
      'collected_on_time', (SELECT collected_on_time FROM sankey),
      'bucket_0_30', (SELECT bucket_0_30 FROM sankey),
      'bucket_31_60', (SELECT bucket_31_60 FROM sankey),
      'bucket_60_plus', (SELECT bucket_60_plus FROM sankey),
      'legal_samadhaan', (SELECT legal_samadhaan FROM sankey),
      'unrecovered', (SELECT unrecovered FROM sankey)
    )
  );
$$;

COMMENT ON FUNCTION get_dashboard_analytics_summary IS
  'Sprint 102: dashboard metric cards, cash flow, aging, and sankey aggregates without pulling ledger arrays into Node.';
