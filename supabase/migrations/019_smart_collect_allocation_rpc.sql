-- Sprint 32: Smart Collect FIFO allocation RPC + transaction collection_mode
-- Depends on: 018_enterprise_ar_os.sql

CREATE TYPE collection_mode AS ENUM (
  'manual',
  'virtual_account',
  'upi_link',
  'system'
);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS collection_mode collection_mode;

COMMENT ON COLUMN transactions.collection_mode IS
  'How the payment was collected. Smart Collect auto-reconciliation uses virtual_account.';

-- ---------------------------------------------------------------------------
-- Atomic FIFO allocation engine (oldest due_date first)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.allocate_inbound_payment_fifo(
  p_inbound_payment_id UUID,
  p_contact_id UUID,
  p_amount_paise BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_rec inbound_payments%ROWTYPE;
  ledger_id UUID;
  ledger_balance_rupees NUMERIC(12, 2);
  ledger_balance_paise BIGINT;
  remaining_paise BIGINT;
  alloc_paise BIGINT;
  alloc_rupees NUMERIC(12, 2);
  seq SMALLINT := 0;
  total_allocated_paise BIGINT := 0;
  allocations JSONB := '[]'::JSONB;
  final_status inbound_payment_status;
  net_outstanding NUMERIC(12, 2);
  txn_payment_method payment_method;
BEGIN
  IF p_amount_paise IS NULL OR p_amount_paise <= 0 THEN
    RAISE EXCEPTION 'allocate_inbound_payment_fifo requires a positive amount in paise.';
  END IF;

  SELECT *
  INTO payment_rec
  FROM inbound_payments
  WHERE id = p_inbound_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inbound payment % not found.', p_inbound_payment_id;
  END IF;

  IF payment_rec.contact_id IS DISTINCT FROM p_contact_id THEN
    RAISE EXCEPTION 'Contact mismatch for inbound payment allocation.';
  END IF;

  IF payment_rec.status IN ('allocated', 'partially_allocated', 'duplicate') THEN
    RETURN jsonb_build_object(
    'already_processed', TRUE,
    'inbound_payment_id', p_inbound_payment_id,
    'contact_id', p_contact_id,
    'status', payment_rec.status,
    'total_allocated_paise', 0,
    'unallocated_paise', 0,
    'allocations', '[]'::JSONB,
    'net_outstanding', (
      SELECT COALESCE(SUM(l.balance_due), 0)
      FROM ledgers l
      WHERE l.contact_id = p_contact_id
        AND l.user_id = payment_rec.user_id
        AND l.balance_due > 0
        AND l.status NOT IN ('paid', 'cancelled', 'refunded')
    )
    );
  END IF;

  IF ROUND(payment_rec.amount * 100)::BIGINT <> p_amount_paise THEN
    RAISE EXCEPTION 'Amount paise mismatch with inbound payment record.';
  END IF;

  txn_payment_method := CASE
    WHEN LOWER(COALESCE(payment_rec.raw_payload #>> '{payload,payment,entity,method}', '')) = 'upi'
      THEN 'upi_link'::payment_method
    ELSE 'bank_transfer'::payment_method
  END;

  remaining_paise := p_amount_paise;

  FOR ledger_id IN
    SELECT l.id
    FROM ledgers l
    WHERE l.contact_id = p_contact_id
      AND l.user_id = payment_rec.user_id
      AND l.balance_due > 0
      AND l.status NOT IN ('paid', 'cancelled', 'refunded')
    ORDER BY l.due_date ASC, l.created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN remaining_paise <= 0;

    SELECT l.balance_due
    INTO ledger_balance_rupees
    FROM ledgers l
    WHERE l.id = ledger_id
    FOR UPDATE;

    IF ledger_balance_rupees IS NULL OR ledger_balance_rupees <= 0 THEN
      CONTINUE;
    END IF;

    ledger_balance_paise := ROUND(ledger_balance_rupees * 100)::BIGINT;

    IF ledger_balance_paise <= 0 THEN
      CONTINUE;
    END IF;

    IF remaining_paise >= ledger_balance_paise THEN
      alloc_paise := ledger_balance_paise;
    ELSE
      alloc_paise := remaining_paise;
    END IF;

    alloc_rupees := (alloc_paise::NUMERIC / 100)::NUMERIC(12, 2);
    seq := seq + 1;

    INSERT INTO payment_allocations (
      inbound_payment_id,
      ledger_id,
      allocated_amount,
      allocation_sequence
    ) VALUES (
      p_inbound_payment_id,
      ledger_id,
      alloc_rupees,
      seq
    );

    INSERT INTO transactions (
      ledger_id,
      transaction_type,
      amount,
      payment_method,
      reference_id,
      inbound_payment_id,
      collection_mode
    ) VALUES (
      ledger_id,
      'payment_received',
      alloc_rupees,
      txn_payment_method,
      payment_rec.external_payment_id,
      p_inbound_payment_id,
      'virtual_account'::collection_mode
    );

    allocations := allocations || jsonb_build_array(
      jsonb_build_object(
        'ledger_id', ledger_id,
        'allocated_amount', alloc_rupees,
        'allocation_sequence', seq
      )
    );

    total_allocated_paise := total_allocated_paise + alloc_paise;
    remaining_paise := remaining_paise - alloc_paise;

    IF alloc_paise < ledger_balance_paise THEN
      EXIT;
    END IF;
  END LOOP;

  IF total_allocated_paise = 0 THEN
    RAISE EXCEPTION 'No open ledgers available for FIFO allocation.';
  END IF;

  IF remaining_paise > 0 THEN
    final_status := 'partially_allocated';
  ELSE
    final_status := 'allocated';
  END IF;

  UPDATE inbound_payments
  SET
    status = final_status,
    processed_at = NOW()
  WHERE id = p_inbound_payment_id;

  SELECT COALESCE(SUM(l.balance_due), 0)
  INTO net_outstanding
  FROM ledgers l
  WHERE l.contact_id = p_contact_id
    AND l.user_id = payment_rec.user_id
    AND l.balance_due > 0
    AND l.status NOT IN ('paid', 'cancelled', 'refunded');

  RETURN jsonb_build_object(
    'already_processed', FALSE,
    'inbound_payment_id', p_inbound_payment_id,
    'contact_id', p_contact_id,
    'status', final_status,
    'total_allocated_paise', total_allocated_paise,
    'unallocated_paise', remaining_paise,
    'allocations', allocations,
    'net_outstanding', net_outstanding
  );
END;
$$;

COMMENT ON FUNCTION public.allocate_inbound_payment_fifo(UUID, UUID, BIGINT) IS
  'Atomically allocates an inbound Smart Collect payment across open ledgers (FIFO by due_date).';
