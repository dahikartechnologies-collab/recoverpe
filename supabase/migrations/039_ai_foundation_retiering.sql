-- Sprint 56: Business subscription re-tiering, AI credits ledger, contact risk scoring.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_subscription_tier') THEN
    CREATE TYPE business_subscription_tier AS ENUM ('free', 'premium');
  END IF;
END $$;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_tier business_subscription_tier NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS ai_credits INT NOT NULL DEFAULT 0 CHECK (ai_credits >= 0);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS risk_score INT NOT NULL DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
  ADD COLUMN IF NOT EXISTS predicted_pay_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reliability_tier VARCHAR(20) NOT NULL DEFAULT 'good'
    CHECK (
      payment_reliability_tier IN ('excellent', 'good', 'at_risk', 'defaulter')
    );

-- Backfill business tier from the workspace owner's user-level subscription plan.
UPDATE businesses b
SET subscription_tier = 'premium'::business_subscription_tier
FROM users u
WHERE u.id = b.user_id
  AND u.subscription_plan = 'premium';

COMMENT ON COLUMN businesses.subscription_tier IS
  'Per-business subscription tier. Source of truth for premium feature gating.';
COMMENT ON COLUMN businesses.ai_credits IS
  'Unified AI credit balance for gateway completions (generalizes legacy VAPI credits).';
COMMENT ON COLUMN contacts.risk_score IS
  'Deterministic payment risk score (0=excellent payer, 100=high default risk).';
COMMENT ON COLUMN contacts.payment_reliability_tier IS
  'Human-readable reliability bucket derived from risk_score.';

CREATE OR REPLACE FUNCTION public.deduct_business_ai_credit(p_business_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_credits INT;
BEGIN
  UPDATE businesses
  SET ai_credits = ai_credits - 1
  WHERE id = p_business_id
    AND ai_credits > 0
  RETURNING ai_credits INTO remaining_credits;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN remaining_credits;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_business_ai_credit(p_business_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_credits INT;
BEGIN
  UPDATE businesses
  SET ai_credits = ai_credits + 1
  WHERE id = p_business_id
  RETURNING ai_credits INTO remaining_credits;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN remaining_credits;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_contact_risk_score(p_contact_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_days_past_due NUMERIC := 0;
  v_partial_ratio NUMERIC := 0;
  v_total_outstanding NUMERIC := 0;
  v_open_count INT := 0;
  v_partial_count INT := 0;
  v_earliest_due DATE;
  v_risk_score INT := 50;
  v_tier VARCHAR(20) := 'good';
  v_predicted_pay_date TIMESTAMPTZ;
  v_days_component NUMERIC;
  v_partial_component NUMERIC;
  v_debt_component NUMERIC;
BEGIN
  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'p_contact_id is required.';
  END IF;

  SELECT
    COALESCE(AVG(GREATEST(0, (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE - l.due_date)), 0),
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE l.status = 'partially_paid')::INT,
    COALESCE(SUM(l.balance_due), 0),
    MIN(l.due_date)
  INTO
    v_avg_days_past_due,
    v_open_count,
    v_partial_count,
    v_total_outstanding,
    v_earliest_due
  FROM ledgers l
  WHERE l.contact_id = p_contact_id
    AND l.balance_due > 0
    AND l.status NOT IN ('paid', 'cancelled', 'refunded');

  IF v_open_count = 0 THEN
    v_risk_score := 15;
    v_tier := 'excellent';
    v_predicted_pay_date := NULL;
  ELSE
    v_partial_ratio := v_partial_count::NUMERIC / GREATEST(v_open_count, 1);
    v_days_component := LEAST(40, v_avg_days_past_due * 2);
    v_partial_component := v_partial_ratio * 25;
    v_debt_component := LEAST(35, (v_total_outstanding / 10000.0) * 35);

    v_risk_score := LEAST(
      100,
      GREATEST(0, ROUND(v_days_component + v_partial_component + v_debt_component)::INT)
    );

    v_tier := CASE
      WHEN v_risk_score <= 25 THEN 'excellent'
      WHEN v_risk_score <= 50 THEN 'good'
      WHEN v_risk_score <= 75 THEN 'at_risk'
      ELSE 'defaulter'
    END;

    v_predicted_pay_date := CASE
      WHEN v_avg_days_past_due > 0 THEN
        (NOW() AT TIME ZONE 'Asia/Kolkata')
        + MAKE_INTERVAL(days => GREATEST(1, ROUND(30 - LEAST(30, v_avg_days_past_due))::INT))
      WHEN v_earliest_due IS NOT NULL THEN
        (v_earliest_due::TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
      ELSE
        NULL
    END;
  END IF;

  UPDATE contacts
  SET
    risk_score = v_risk_score,
    payment_reliability_tier = v_tier,
    predicted_pay_date = v_predicted_pay_date
  WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact % not found.', p_contact_id;
  END IF;

  RETURN v_risk_score;
END;
$$;

COMMENT ON FUNCTION public.calculate_contact_risk_score(UUID) IS
  'Deterministic payment risk score from overdue days, partial-payment behavior, and outstanding debt.';
