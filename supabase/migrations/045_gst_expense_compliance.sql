-- Sprint 58: CA compliance — GST and TDS capture on expenses, expense voucher
-- numbering, and cadence retry bookkeeping. Run after 044.
--
-- The expense module previously stored only payee, amount, category, mode,
-- reference, date, and notes. A CA could not derive input tax credit from it,
-- which is the core of the Tally replacement claim.

-- ---------------------------------------------------------------------------
-- 1. Cadence retry bookkeeping (completes the 044 autopilot work)
--
-- A claimed cadence run that fails dispatch is returned to 'pending'. Without
-- an attempt ceiling a permanently undeliverable number is retried forever.
-- ---------------------------------------------------------------------------

ALTER TYPE cadence_run_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE cadence_run_status ADD VALUE IF NOT EXISTS 'in_progress';

ALTER TABLE cadence_runs
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN cadence_runs.claimed_at IS
  'Set when a worker claims the run as in_progress. Stale claims older than two minutes are reclaimed by the next cron tick.';

COMMENT ON COLUMN cadence_runs.attempt_count IS
  'Dispatch attempts burned. At 3 the run is retired as failed rather than retried.';

-- ---------------------------------------------------------------------------
-- 2. GST and TDS fields on expenses
-- ---------------------------------------------------------------------------

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS voucher_number TEXT,
  ADD COLUMN IF NOT EXISTS supplier_gstin TEXT,
  ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT,
  ADD COLUMN IF NOT EXISTS place_of_supply TEXT,
  ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_input_credit_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS tds_section TEXT,
  ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Existing rows predate tax capture; treat the whole amount as taxable value
-- at a zero rate so the sum of taxable_value + tax always equals amount.
UPDATE expenses
   SET taxable_value = amount
 WHERE taxable_value = 0
   AND amount > 0;

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_gstin_format;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_gstin_format
  CHECK (
    supplier_gstin IS NULL
    OR supplier_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
  );

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_gst_rate_allowed;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_gst_rate_allowed
  CHECK (gst_rate IN (0, 0.25, 3, 5, 12, 18, 28));

-- Intra-state supply splits into CGST + SGST; inter-state is IGST. A row
-- carrying both is always a calculation bug.
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_gst_split_exclusive;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_gst_split_exclusive
  CHECK (
    igst_amount = 0
    OR (cgst_amount = 0 AND sgst_amount = 0)
  );

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_gst_amounts_non_negative;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_gst_amounts_non_negative
  CHECK (
    taxable_value >= 0
    AND cgst_amount >= 0
    AND sgst_amount >= 0
    AND igst_amount >= 0
    AND tds_amount >= 0
  );

-- The stored total must reconcile with its components, otherwise an export
-- would report a GSTR figure that does not tie back to the voucher.
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_total_reconciles;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_total_reconciles
  CHECK (
    ABS(amount - (taxable_value + cgst_amount + sgst_amount + igst_amount)) <= 0.02
  );

-- PostgreSQL treats NULLs as distinct in unique indexes, so a single
-- (user_id, business_id, voucher_number) index would not stop two personal-mode
-- expenses from sharing a voucher number.
DROP INDEX IF EXISTS idx_expenses_voucher_number;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_voucher_number_business
  ON expenses (user_id, business_id, voucher_number)
  WHERE voucher_number IS NOT NULL AND business_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_voucher_number_personal
  ON expenses (user_id, voucher_number)
  WHERE voucher_number IS NOT NULL AND business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_user_date
  ON expenses (user_id, expense_date DESC);

COMMENT ON COLUMN expenses.place_of_supply IS
  'Two-digit GST state code. Compared against the business GSTIN prefix to choose CGST/SGST versus IGST.';

COMMENT ON COLUMN expenses.is_input_credit_eligible IS
  'False for blocked credits under CGST Act s.17(5), e.g. personal use or motor vehicles.';

-- ---------------------------------------------------------------------------
-- 3. Expense voucher sequence, mirroring businesses.next_invoice_sequence
-- ---------------------------------------------------------------------------

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS next_expense_voucher_sequence INTEGER NOT NULL DEFAULT 1;

/**
 * Allocates the next voucher number for a workspace.
 *
 * Locks the business row so two concurrent expense submissions cannot be
 * handed the same number. Personal-mode expenses have no business row, so
 * they fall back to a per-user count.
 */
CREATE OR REPLACE FUNCTION public.next_expense_voucher_number(
  p_user_id UUID,
  p_business_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_sequence INTEGER;
  fiscal_year TEXT;
BEGIN
  -- Indian fiscal year runs April to March.
  SELECT CASE
    WHEN EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'Asia/Kolkata')) >= 4
      THEN TO_CHAR((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YY')
        || '-'
        || TO_CHAR((NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 year', 'YY')
    ELSE TO_CHAR((NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '1 year', 'YY')
        || '-'
        || TO_CHAR((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YY')
  END INTO fiscal_year;

  IF p_business_id IS NULL THEN
    -- Serialise personal-mode allocations; COUNT(*) + 1 is not safe alone.
    PERFORM pg_advisory_xact_lock(('x' || substr(md5(p_user_id::text), 1, 16))::bit(64)::bigint);

    SELECT COUNT(*) + 1
      INTO next_sequence
      FROM expenses
     WHERE user_id = p_user_id
       AND business_id IS NULL;
  ELSE
    UPDATE businesses
       SET next_expense_voucher_sequence = next_expense_voucher_sequence + 1
     WHERE id = p_business_id
       AND user_id = p_user_id
    RETURNING next_expense_voucher_sequence - 1 INTO next_sequence;

    IF next_sequence IS NULL THEN
      RAISE EXCEPTION 'Business % not found for user %', p_business_id, p_user_id;
    END IF;
  END IF;

  RETURN 'EXP/' || fiscal_year || '/' || LPAD(next_sequence::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.next_expense_voucher_number IS
  'Allocates a gapless per-workspace expense voucher number under a row lock.';
