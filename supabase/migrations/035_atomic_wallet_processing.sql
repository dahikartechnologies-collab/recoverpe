-- Sprint 52: Atomic claim-and-credit for inbound Smart Collect payments.
--
-- Problem this fixes:
--   reconcileContactVirtualAccountCredit previously decided whether to credit a
--   wallet by reading inbound_payments.status === 'received' and then issuing a
--   separate credit_contact_wallet call. Two concurrent deliveries of the same
--   virtual_account.credited event could both observe 'received' and both
--   credit the wallet, doubling the customer's money.
--
-- Fix:
--   Make the status transition itself the lock. A single UPDATE ... WHERE
--   status = 'received' is a compare-and-set: under READ COMMITTED the second
--   concurrent writer blocks on the row lock, then re-evaluates the predicate
--   against the committed row and matches zero rows. Only the winner credits.
--
--   The credit runs inside the same function (and therefore the same
--   transaction) as the claim, so a failure to credit rolls the claim back to
--   'received' and the event stays safely retryable. This also closes the
--   crash-between-credit-and-status-update window from the previous design.

-- ---------------------------------------------------------------------------
-- Observability: when did this payment enter 'processing'?
-- ---------------------------------------------------------------------------

ALTER TABLE inbound_payments
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

COMMENT ON COLUMN inbound_payments.processing_started_at IS
  'Set when a webhook invocation wins the received -> processing claim. Rows stuck in processing with an old timestamp indicate a crashed reconciliation run.';

-- Cheap lookup for the stuck-payment sweep.
CREATE INDEX IF NOT EXISTS idx_inbound_payments_processing_started_at
  ON inbound_payments (processing_started_at)
  WHERE status = 'processing';

-- ---------------------------------------------------------------------------
-- Atomic claim + credit
-- ---------------------------------------------------------------------------

-- Returns one of four outcomes:
--
--   credited      This call won the received -> processing transition and
--                 credited the wallet. It owns allocation.
--   resumed       A previous run crashed while holding the claim. The wallet
--                 was already credited; this call takes over allocation only.
--   in_progress   Another invocation holds a fresh claim right now. Do nothing.
--   already_final The event reached a terminal status. Do nothing.
--
-- The in_progress outcome matters as much as the claim itself. Allocation reads
-- open ledgers and then debits the wallet, so two invocations allocating the
-- same payment concurrently would both pass the duplicate-transaction check and
-- over-debit the wallet. Exactly one invocation may allocate at a time.

CREATE OR REPLACE FUNCTION public.claim_and_credit_inbound_payment(
  p_inbound_payment_id UUID,
  p_user_id UUID,
  p_contact_id UUID,
  p_amount NUMERIC,
  p_stale_after_seconds INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed_id UUID;
  v_current_status inbound_payment_status;
  v_new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'claim_and_credit_inbound_payment requires a positive amount.';
  END IF;

  -- Compare-and-set. Exactly one concurrent caller can win this transition.
  UPDATE inbound_payments
  SET
    status = 'processing',
    processing_started_at = NOW()
  WHERE id = p_inbound_payment_id
    AND status = 'received'
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NOT NULL THEN
    -- Same transaction as the claim: if this raises, the claim rolls back and
    -- the row returns to 'received' so a Razorpay retry can process it.
    v_new_balance := public.credit_contact_wallet(p_user_id, p_contact_id, p_amount);

    RETURN jsonb_build_object(
      'outcome', 'credited',
      'status', 'processing',
      'wallet_balance', v_new_balance
    );
  END IF;

  SELECT status
  INTO v_current_status
  FROM inbound_payments
  WHERE id = p_inbound_payment_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Inbound payment % not found.', p_inbound_payment_id;
  END IF;

  IF v_current_status <> 'processing' THEN
    RETURN jsonb_build_object(
      'outcome',
      CASE WHEN v_current_status = 'received' THEN 'in_progress' ELSE 'already_final' END,
      'status', v_current_status::TEXT,
      'wallet_balance', NULL
    );
  END IF;

  -- Second compare-and-set: take over a claim abandoned by a crashed run.
  -- Re-stamping processing_started_at means only one retry can win the
  -- takeover, even if several arrive at once.
  UPDATE inbound_payments
  SET processing_started_at = NOW()
  WHERE id = p_inbound_payment_id
    AND status = 'processing'
    AND processing_started_at IS NOT NULL
    AND processing_started_at < NOW() - MAKE_INTERVAL(secs => p_stale_after_seconds)
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NOT NULL THEN
    -- Wallet was credited by the run that died. Do not credit again.
    RETURN jsonb_build_object(
      'outcome', 'resumed',
      'status', 'processing',
      'wallet_balance', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'in_progress',
    'status', 'processing',
    'wallet_balance', NULL
  );
END;
$$;

COMMENT ON FUNCTION public.claim_and_credit_inbound_payment(UUID, UUID, UUID, NUMERIC, INTEGER) IS
  'Atomically claims an inbound payment and credits the contact wallet in one transaction. Returns {outcome, status, wallet_balance} where outcome is credited | resumed | in_progress | already_final. Only credited and resumed permit the caller to allocate.';

-- ---------------------------------------------------------------------------
-- Terminal status write, with processed_at stamped in the same statement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finalize_inbound_payment(
  p_inbound_payment_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('allocated', 'partially_allocated', 'duplicate', 'failed') THEN
    RAISE EXCEPTION 'finalize_inbound_payment received a non-terminal status: %', p_status;
  END IF;

  UPDATE inbound_payments
  SET
    status = p_status::inbound_payment_status,
    processed_at = NOW()
  WHERE id = p_inbound_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inbound payment % not found.', p_inbound_payment_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.finalize_inbound_payment(UUID, TEXT) IS
  'Moves an inbound payment to a terminal status and stamps processed_at. Rejects non-terminal statuses so a caller cannot accidentally reopen an event for re-crediting.';

GRANT EXECUTE ON FUNCTION public.claim_and_credit_inbound_payment(UUID, UUID, UUID, NUMERIC, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_inbound_payment(UUID, TEXT) TO service_role;
