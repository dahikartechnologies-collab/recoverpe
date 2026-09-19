-- Master Sprint (part 2): audit logs, viewer role constraint, payout settlement, KYC columns.
-- Requires 053_master_sprint_tier1.sql to be committed first.

ALTER TABLE workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_invited_role;

ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_invited_role CHECK (
    role IN ('admin', 'field_staff', 'recovery_agent', 'accountant', 'viewer')
  );

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id);

COMMENT ON TABLE audit_logs IS
  'Append-only security and business mutation trail for super-admin review.';

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Inserts are performed only via service-role API routes (RLS bypass).
-- No INSERT policy is defined so authenticated clients cannot append rows.

DROP POLICY IF EXISTS audit_logs_service_insert ON audit_logs;

DROP POLICY IF EXISTS audit_logs_super_admin_select ON audit_logs;

CREATE POLICY audit_logs_super_admin_select ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth_user_id() AND u.is_super_admin = true
    )
  );

ALTER TABLE agent_payouts
  ADD COLUMN IF NOT EXISTS utr_number TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS razorpay_payout_id TEXT;

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS pan_number TEXT,
  ADD COLUMN IF NOT EXISTS pan_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS pan_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN agents.pan_verified_at IS 'Set when NSDL PAN verification succeeds.';
COMMENT ON COLUMN agents.bank_verified_at IS 'Set when penny-drop bank verification succeeds.';
COMMENT ON COLUMN agents.kyc_verified_at IS 'Set when both PAN and bank verification succeed.';
