-- Sprint 58.4: Field Agent mini-CRM — bank payout details and KYC uploads.

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
  ADD COLUMN IF NOT EXISTS kyc_document_url TEXT;

COMMENT ON COLUMN agents.bank_account_name IS
  'Beneficiary name for agent commission payouts.';
COMMENT ON COLUMN agents.bank_account_number IS
  'Bank account number for agent commission payouts.';
COMMENT ON COLUMN agents.bank_ifsc IS
  'IFSC code for agent commission payouts.';
COMMENT ON COLUMN agents.kyc_document_url IS
  'JSON map of KYC document storage paths, e.g. {"front":"...","back":"..."}.';

CREATE POLICY agents_update_own_profile ON agents
  FOR UPDATE
  USING (user_id = auth_user_id())
  WITH CHECK (user_id = auth_user_id());

CREATE POLICY agent_referrals_update_own ON agent_referrals
  FOR UPDATE
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth_user_id())
  )
  WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth_user_id())
  );
