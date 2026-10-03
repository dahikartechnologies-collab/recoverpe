-- Sprint 103: Multiple verified settlement accounts per business.
-- Each additional account still requires a ₹5 reverse penny-drop payment.

ALTER TABLE merchant_bank_accounts
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE merchant_bank_accounts
  DROP CONSTRAINT IF EXISTS merchant_bank_accounts_account_type_check;

ALTER TABLE merchant_bank_accounts
  ADD CONSTRAINT merchant_bank_accounts_account_type_check
  CHECK (account_type IN ('business', 'personal'));

COMMENT ON COLUMN merchant_bank_accounts.account_type IS
  'business = current/current-like settlement account; personal = savings/personal account.';

COMMENT ON COLUMN merchant_bank_accounts.is_primary IS
  'Exactly one verified account per business may be primary for Smart Collect routing.';

UPDATE merchant_bank_accounts AS mba
SET is_primary = true
WHERE mba.id = (
  SELECT oldest.id
  FROM merchant_bank_accounts AS oldest
  WHERE oldest.business_id = mba.business_id
  ORDER BY oldest.created_at ASC, oldest.id ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM merchant_bank_accounts AS existing
  WHERE existing.business_id = mba.business_id
    AND existing.is_primary = true
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_bank_accounts_one_primary
  ON merchant_bank_accounts (business_id)
  WHERE is_primary = true;

CREATE OR REPLACE FUNCTION public.merchant_bank_accounts_ensure_single_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary IS TRUE THEN
    UPDATE merchant_bank_accounts
    SET is_primary = FALSE
    WHERE business_id = NEW.business_id
      AND id IS DISTINCT FROM NEW.id
      AND is_primary = TRUE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merchant_bank_accounts_single_primary
  ON merchant_bank_accounts;

CREATE TRIGGER trg_merchant_bank_accounts_single_primary
BEFORE INSERT OR UPDATE OF is_primary
ON merchant_bank_accounts
FOR EACH ROW
WHEN (NEW.is_primary IS TRUE)
EXECUTE FUNCTION public.merchant_bank_accounts_ensure_single_primary();

ALTER TABLE razorpay_orders
  ADD COLUMN IF NOT EXISTS verification_account_type TEXT;

ALTER TABLE razorpay_orders
  DROP CONSTRAINT IF EXISTS razorpay_orders_verification_account_type_check;

ALTER TABLE razorpay_orders
  ADD CONSTRAINT razorpay_orders_verification_account_type_check
  CHECK (
    verification_account_type IS NULL
    OR verification_account_type IN ('business', 'personal')
  );

COMMENT ON COLUMN razorpay_orders.verification_account_type IS
  'Remembered account_type for bank_verification_5 orders so webhook fulfillment can insert the correct merchant_bank_accounts row.';
