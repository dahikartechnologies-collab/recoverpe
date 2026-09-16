-- Sprint 58.3: Promise Register + Settlement Desk add-ons, proof metering, DHS view.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS addons JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS proof_quota_used_month INT NOT NULL DEFAULT 0;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS proof_quota_reset_on DATE;

COMMENT ON COLUMN businesses.addons IS
  'Paid command-center add-ons keyed by SKU (promise_register_monthly, settlement_desk_monthly).';

COMMENT ON COLUMN businesses.proof_quota_used_month IS
  'Settlement Desk free-tier vision proofs consumed in the current IST month.';

ALTER TABLE razorpay_orders
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_business_id
  ON razorpay_orders (business_id)
  WHERE business_id IS NOT NULL;

-- Read-only promise keep/break ratio for dashboards and DHS audits.
CREATE OR REPLACE VIEW v_debtor_health AS
SELECT
  c.id AS contact_id,
  c.user_id,
  c.debtor_health_score,
  COALESCE(p.kept_count, 0) AS kept_promises_90d,
  COALESCE(p.broken_count, 0) AS broken_promises_90d,
  CASE
    WHEN COALESCE(p.kept_count, 0) + COALESCE(p.broken_count, 0) = 0 THEN NULL
    ELSE ROUND(
      100.0 * COALESCE(p.kept_count, 0)::numeric
        / (COALESCE(p.kept_count, 0) + COALESCE(p.broken_count, 0))::numeric,
      1
    )
  END AS promise_keep_ratio_pct
FROM contacts c
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE pp.status = 'kept') AS kept_count,
    COUNT(*) FILTER (WHERE pp.status = 'broken') AS broken_count
  FROM payment_promises pp
  WHERE pp.contact_id = c.id
    AND pp.status IN ('kept', 'broken')
    AND pp.promised_on >= (CURRENT_DATE - INTERVAL '90 days')
) p ON TRUE;

COMMENT ON VIEW v_debtor_health IS
  '90-day promise keep/break ratio per contact; DHS nightly job uses the same signals.';
