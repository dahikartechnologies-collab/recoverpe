-- Sprint 48: Khata Wallet — advance payments and running ledger credits on contacts.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN contacts.wallet_balance IS
  'Running khata balance. Positive = advance/deposit held by the business. Negative = net amount the contact owes.';

CREATE OR REPLACE FUNCTION public.credit_contact_wallet(
  p_user_id UUID,
  p_contact_id UUID,
  p_amount NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'credit_contact_wallet requires a positive amount.';
  END IF;

  UPDATE contacts
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_contact_id
    AND user_id = p_user_id
  RETURNING wallet_balance INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found or access denied.';
  END IF;

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.debit_contact_wallet(
  p_user_id UUID,
  p_contact_id UUID,
  p_amount NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  available NUMERIC;
  applied NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
  END IF;

  SELECT wallet_balance
  INTO available
  FROM contacts
  WHERE id = p_contact_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found or access denied.';
  END IF;

  applied := LEAST(GREATEST(COALESCE(available, 0), 0), p_amount);

  IF applied <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE contacts
  SET wallet_balance = wallet_balance - applied
  WHERE id = p_contact_id
    AND user_id = p_user_id;

  RETURN applied;
END;
$$;

COMMENT ON FUNCTION public.credit_contact_wallet(UUID, UUID, NUMERIC) IS
  'Atomically credits a contact khata wallet (advance/jama). Returns the new balance.';

COMMENT ON FUNCTION public.debit_contact_wallet(UUID, UUID, NUMERIC) IS
  'Atomically debits up to p_amount from a contact wallet when balance is positive. Returns amount applied.';
