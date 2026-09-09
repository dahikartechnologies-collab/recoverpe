-- Sprint 28: Atomic VAPI wallet reserve / refund for credit reservation.

CREATE OR REPLACE FUNCTION public.reserve_vapi_credits(
  p_user_id UUID,
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
    RAISE EXCEPTION 'reserve_vapi_credits requires a positive amount.';
  END IF;

  UPDATE users
  SET vapi_wallet_balance = vapi_wallet_balance - p_amount
  WHERE id = p_user_id
    AND vapi_wallet_balance >= p_amount
  RETURNING vapi_wallet_balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_vapi_credits(
  p_user_id UUID,
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
    RAISE EXCEPTION 'refund_vapi_credits requires a positive amount.';
  END IF;

  UPDATE users
  SET vapi_wallet_balance = vapi_wallet_balance + p_amount
  WHERE id = p_user_id
  RETURNING vapi_wallet_balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN new_balance;
END;
$$;

COMMENT ON FUNCTION public.reserve_vapi_credits(UUID, NUMERIC) IS
  'Atomically deducts VAPI credits when balance is sufficient; returns new balance or NULL.';

COMMENT ON FUNCTION public.refund_vapi_credits(UUID, NUMERIC) IS
  'Atomically refunds VAPI credits after a failed outbound call reservation.';
