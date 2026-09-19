-- Sprint 77: Reverse penny drop — verified merchant settlement accounts.

CREATE TABLE IF NOT EXISTS merchant_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  account_number TEXT,
  ifsc TEXT,
  upi_vpa TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verification_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT merchant_bank_accounts_has_source CHECK (
    upi_vpa IS NOT NULL OR (account_number IS NOT NULL AND ifsc IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_merchant_bank_accounts_business_id
  ON merchant_bank_accounts (business_id);

CREATE INDEX IF NOT EXISTS idx_merchant_bank_accounts_verified
  ON merchant_bank_accounts (business_id, is_verified)
  WHERE is_verified = true;

COMMENT ON TABLE merchant_bank_accounts IS
  'RBI-compliant settlement accounts captured via Razorpay reverse penny-drop verification.';

ALTER TABLE merchant_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS merchant_bank_accounts_select_own ON merchant_bank_accounts;
DROP POLICY IF EXISTS merchant_bank_accounts_insert_own ON merchant_bank_accounts;

CREATE POLICY merchant_bank_accounts_select_own ON merchant_bank_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = merchant_bank_accounts.business_id
        AND b.user_id = auth_user_id()
    )
  );

CREATE POLICY merchant_bank_accounts_insert_own ON merchant_bank_accounts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = merchant_bank_accounts.business_id
        AND b.user_id = auth_user_id()
    )
  );

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN businesses.kyc_verified_at IS
  'Set when reverse penny-drop bank verification succeeds for settlements.';
