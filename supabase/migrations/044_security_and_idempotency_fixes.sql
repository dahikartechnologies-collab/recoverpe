-- Sprint 57: Production hardening — tenant isolation on billing/verification
-- tables, a race-free ledger balance trigger, and idempotency keys on the
-- payment-claim path. Run in Supabase SQL Editor after 043.
--
-- NOTE ON DATA PRECONDITIONS: the CHECK constraints below are added NOT VALID
-- and then validated. If validation fails, pre-existing rows violate the
-- invariant — inspect and correct them, then re-run the VALIDATE statement.

-- ---------------------------------------------------------------------------
-- 1. Row Level Security on previously unprotected tables
--
-- Every API route uses the service role, which bypasses RLS, so these policies
-- are defence-in-depth: they make a mis-scoped anon-key query fail closed
-- rather than leak another tenant's billing and payment records.
--
-- Policies use auth_user_id() (002_core_schema.sql:57) rather than auth.uid()
-- directly, because authentication is Firebase-based — auth.uid() is NULL for
-- every real user and would deny-all.
-- ---------------------------------------------------------------------------

-- payment_verifications: debtor-submitted proof, visible to the whole workspace.
ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_verifications_select ON payment_verifications;
DROP POLICY IF EXISTS payment_verifications_insert ON payment_verifications;
DROP POLICY IF EXISTS payment_verifications_update ON payment_verifications;
DROP POLICY IF EXISTS payment_verifications_delete ON payment_verifications;

CREATE POLICY payment_verifications_select ON payment_verifications
  FOR SELECT
  USING (can_manage_workspace(payment_verifications.user_id));

CREATE POLICY payment_verifications_insert ON payment_verifications
  FOR INSERT
  WITH CHECK (can_manage_workspace(payment_verifications.user_id));

CREATE POLICY payment_verifications_update ON payment_verifications
  FOR UPDATE
  USING (can_manage_workspace(payment_verifications.user_id))
  WITH CHECK (can_manage_workspace(payment_verifications.user_id));

CREATE POLICY payment_verifications_delete ON payment_verifications
  FOR DELETE
  USING (can_manage_workspace(payment_verifications.user_id));

-- razorpay_orders / razorpay_subscriptions: billing is strictly owner-scoped.
-- A workspace member must never read the owner's payment instruments, so these
-- resolve the actor directly instead of going through can_manage_workspace().
ALTER TABLE razorpay_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS razorpay_orders_select_own ON razorpay_orders;
DROP POLICY IF EXISTS razorpay_orders_insert_own ON razorpay_orders;

CREATE POLICY razorpay_orders_select_own ON razorpay_orders
  FOR SELECT
  USING (user_id = auth_user_id());

CREATE POLICY razorpay_orders_insert_own ON razorpay_orders
  FOR INSERT
  WITH CHECK (user_id = auth_user_id());

ALTER TABLE razorpay_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS razorpay_subscriptions_select_own ON razorpay_subscriptions;
DROP POLICY IF EXISTS razorpay_subscriptions_insert_own ON razorpay_subscriptions;

CREATE POLICY razorpay_subscriptions_select_own ON razorpay_subscriptions
  FOR SELECT
  USING (user_id = auth_user_id());

CREATE POLICY razorpay_subscriptions_insert_own ON razorpay_subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth_user_id());

-- cadence_runs has no user_id column (038_tiered_autopilot.sql:5-13); tenancy
-- is derived through the parent ledger.
ALTER TABLE cadence_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cadence_runs_select ON cadence_runs;
DROP POLICY IF EXISTS cadence_runs_write ON cadence_runs;

CREATE POLICY cadence_runs_select ON cadence_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = cadence_runs.ledger_id
        AND can_manage_workspace(l.user_id)
    )
  );

CREATE POLICY cadence_runs_write ON cadence_runs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = cadence_runs.ledger_id
        AND can_manage_workspace(l.user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Race-free ledger balance recalculation
--
-- The previous trigger read SUM(amount) before acquiring any lock on the
-- ledger row. Two concurrent payment inserts each saw a partial sum and the
-- later UPDATE overwrote the earlier one, silently discarding a payment.
--
-- Taking the ledger row lock first serialises recalculation per ledger.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalculate_ledger_balance(p_ledger_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  ledger_total NUMERIC(12, 2);
  ledger_due_date DATE;
  applied_sum NUMERIC(12, 2);
  new_balance NUMERIC(12, 2);
  today_ist DATE;
BEGIN
  IF p_ledger_id IS NULL THEN
    RETURN;
  END IF;

  -- Lock before summing. Any concurrent transaction touching this ledger
  -- blocks here and recomputes against committed state instead of racing.
  SELECT total_amount, due_date
    INTO ledger_total, ledger_due_date
    FROM ledgers
   WHERE id = p_ledger_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Only money that genuinely reduces the receivable counts. refund_issued is
  -- money returned to the customer and must never mark an invoice as paid.
  SELECT COALESCE(SUM(amount), 0)
    INTO applied_sum
    FROM transactions
   WHERE ledger_id = p_ledger_id
     AND transaction_type IN (
       'payment_received',
       'credit_note_applied',
       'bad_debt_writeoff',
       'wallet_advance'
     );

  new_balance := GREATEST(ledger_total - applied_sum, 0);
  today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

  UPDATE ledgers
     SET
       balance_due = new_balance,
       status = CASE
         WHEN new_balance <= 0 THEN 'paid'::ledger_status
         WHEN applied_sum > 0 AND new_balance > 0 THEN 'partially_paid'::ledger_status
         WHEN ledger_due_date < today_ist AND new_balance > 0 THEN 'overdue'::ledger_status
         ELSE 'pending'::ledger_status
       END,
       updated_at = NOW()
   WHERE id = p_ledger_id;
END;
$$;

COMMENT ON FUNCTION public.recalculate_ledger_balance IS
  'Locks the ledger row, then recomputes balance_due and status from credit-side transactions. Overdue uses IST to match application date logic.';

CREATE OR REPLACE FUNCTION public.calculate_balance_due()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_ledger_balance(OLD.ledger_id);
    RETURN OLD;
  END IF;

  -- A re-pointed transaction leaves the old ledger stale unless it is
  -- recalculated too.
  IF TG_OP = 'UPDATE' AND OLD.ledger_id IS DISTINCT FROM NEW.ledger_id THEN
    PERFORM public.recalculate_ledger_balance(OLD.ledger_id);
  END IF;

  PERFORM public.recalculate_ledger_balance(NEW.ledger_id);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.calculate_balance_due IS
  'Recalculates ledgers.balance_due and status after any transaction insert, update, or delete.';

-- The old trigger fired on INSERT only, so edits and deletions left balances
-- permanently stale.
DROP TRIGGER IF EXISTS trg_transactions_calculate_balance_due ON transactions;

CREATE TRIGGER trg_transactions_calculate_balance_due
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_balance_due();

-- Backfill: ledgers whose balance was previously reduced by a refund are wrong
-- under the corrected credit-type filter.
DO $$
DECLARE
  affected_ledger UUID;
BEGIN
  FOR affected_ledger IN
    SELECT DISTINCT ledger_id
    FROM transactions
    WHERE ledger_id IS NOT NULL
      AND transaction_type = 'refund_issued'
  LOOP
    PERFORM public.recalculate_ledger_balance(affected_ledger);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Payment-claim idempotency
-- ---------------------------------------------------------------------------

-- Durable copy of the customer's screenshot. Meta media URLs expire in minutes,
-- so media_id alone leaves the review queue with nothing to show.
ALTER TABLE reconciliations
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'whatsapp';

ALTER TABLE reconciliations
  DROP CONSTRAINT IF EXISTS reconciliations_source_allowed;

ALTER TABLE reconciliations
  ADD CONSTRAINT reconciliations_source_allowed
  CHECK (source IN ('whatsapp', 'portal_upload'));

COMMENT ON COLUMN reconciliations.proof_url IS
  'Storage object path for the retained payment screenshot. Served via a short-lived signed URL, never exposed directly.';

COMMENT ON COLUMN reconciliations.source IS
  'whatsapp = inbound Meta image; portal_upload = debtor upload from /pay/[id].';

-- One inbound WhatsApp message fans out to every merchant the customer owes,
-- so uniqueness on the Meta wamid belongs per workspace. 043 applied the same
-- correction to communication_logs but missed this table, which silently
-- dropped the second merchant's claim.
DROP INDEX IF EXISTS idx_reconciliations_external_message_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliations_external_message_user
  ON reconciliations (external_message_id, user_id)
  WHERE external_message_id IS NOT NULL;

-- Collapse pre-existing duplicate UTR claims before enforcing uniqueness.
-- Only unreviewed rows are removed, and the earliest claim is always kept, so
-- no approved settlement or audit record is lost.
DELETE FROM reconciliations r
WHERE r.status = 'pending_review'
  AND r.extracted_utr IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM reconciliations keeper
    WHERE keeper.user_id = r.user_id
      AND keeper.extracted_utr = r.extracted_utr
      AND (
        keeper.created_at < r.created_at
        OR (keeper.created_at = r.created_at AND keeper.id < r.id)
      )
  );

-- A customer re-sending the same screenshot must not create a second
-- settleable claim for the same merchant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliations_user_utr
  ON reconciliations (user_id, extracted_utr)
  WHERE extracted_utr IS NOT NULL;

COMMENT ON INDEX idx_reconciliations_user_utr IS
  'Idempotency key for payment claims: one claim per UTR per workspace.';

-- ---------------------------------------------------------------------------
-- 4. Money invariants
-- ---------------------------------------------------------------------------

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_amount_positive;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0) NOT VALID;

ALTER TABLE transactions
  VALIDATE CONSTRAINT transactions_amount_positive;

ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_wallet_balance_non_negative;

ALTER TABLE contacts
  ADD CONSTRAINT contacts_wallet_balance_non_negative
  CHECK (wallet_balance >= 0) NOT VALID;

ALTER TABLE contacts
  VALIDATE CONSTRAINT contacts_wallet_balance_non_negative;
