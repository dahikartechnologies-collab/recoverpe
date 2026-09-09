-- Sprint 35: Khata QR — customer self-onboard waiting room.

CREATE TABLE pending_onboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pending_onboards_customer_name_present CHECK (NULLIF(BTRIM(customer_name), '') IS NOT NULL),
  CONSTRAINT pending_onboards_customer_phone_present CHECK (NULLIF(BTRIM(customer_phone), '') IS NOT NULL)
);

CREATE INDEX idx_pending_onboards_business_pending
  ON pending_onboards (business_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX idx_pending_onboards_business_id ON pending_onboards (business_id);

COMMENT ON TABLE pending_onboards IS
  'Khata QR self-onboard queue. Public inserts via service role; merchants approve into contacts/ledgers.';

ALTER TABLE pending_onboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY pending_onboards_select ON pending_onboards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = pending_onboards.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY pending_onboards_update ON pending_onboards
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = pending_onboards.business_id
        AND can_manage_workspace(b.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = pending_onboards.business_id
        AND can_manage_workspace(b.user_id)
    )
  );
