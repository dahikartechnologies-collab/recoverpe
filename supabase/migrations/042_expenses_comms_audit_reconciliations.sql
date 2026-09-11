-- Sprint 56: Expense tracking (accounts payable), communication audit trail,
-- and AI payment-screenshot reconciliations.
-- Run in Supabase SQL Editor after prior migrations.

-- ---------------------------------------------------------------------------
-- Expenses (accounts payable)
-- ---------------------------------------------------------------------------

CREATE TYPE expense_category AS ENUM (
  'raw_material',
  'transport_freight',
  'rent',
  'utilities',
  'salaries',
  'office_expense'
);

CREATE TYPE expense_payment_mode AS ENUM (
  'bank_transfer',
  'upi',
  'cash',
  'cheque'
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses (id) ON DELETE SET NULL,
  payee_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category expense_category NOT NULL,
  payment_mode expense_payment_mode NOT NULL,
  reference_number TEXT,
  expense_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_user_id ON expenses (user_id);
CREATE INDEX idx_expenses_business_id ON expenses (business_id);
CREATE INDEX idx_expenses_expense_date ON expenses (expense_date DESC);

COMMENT ON TABLE expenses IS
  'Money-out ledger for MSME accounts payable. Pairs with ledgers (money-in) to produce net cashflow.';

COMMENT ON COLUMN expenses.business_id IS
  'Nullable to match ledgers: NULL scopes the expense to the personal workspace.';

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY expenses_select_workspace ON expenses
  FOR SELECT
  USING (can_manage_workspace(expenses.user_id));

CREATE POLICY expenses_insert_workspace ON expenses
  FOR INSERT
  WITH CHECK (can_manage_workspace(expenses.user_id));

CREATE POLICY expenses_update_workspace ON expenses
  FOR UPDATE
  USING (can_manage_workspace(expenses.user_id));

CREATE POLICY expenses_delete_workspace ON expenses
  FOR DELETE
  USING (can_manage_workspace(expenses.user_id));

-- ---------------------------------------------------------------------------
-- Communication audit trail
-- communication_logs already exists (002, extended in 007/018/032). Extend it
-- rather than replacing it: the autopilot 24h dedup gate reads this table.
-- ---------------------------------------------------------------------------

CREATE TYPE communication_channel AS ENUM ('whatsapp', 'sms', 'email', 'voice');
CREATE TYPE communication_direction AS ENUM ('inbound', 'outbound');

ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS channel communication_channel NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS direction communication_direction NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS external_message_id TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- Backfill tenancy from the ledger before enforcing NOT NULL.
UPDATE communication_logs cl
SET user_id = l.user_id,
    business_id = COALESCE(cl.business_id, l.business_id),
    contact_id = COALESCE(cl.contact_id, l.contact_id)
FROM ledgers l
WHERE l.id = cl.ledger_id
  AND cl.user_id IS NULL;

-- Existing writers (vapi/call, transactions, notifications dispatcher, vapi
-- webhook) insert with ledger_id only. Derive tenancy for them so the NOT NULL
-- below holds no matter which order the migration and the deploy land in.
CREATE OR REPLACE FUNCTION communication_logs_fill_tenancy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ledger_id IS NOT NULL
     AND (NEW.user_id IS NULL OR NEW.contact_id IS NULL OR NEW.business_id IS NULL) THEN
    SELECT COALESCE(NEW.user_id, l.user_id),
           COALESCE(NEW.contact_id, l.contact_id),
           COALESCE(NEW.business_id, l.business_id)
      INTO NEW.user_id, NEW.contact_id, NEW.business_id
      FROM ledgers l
     WHERE l.id = NEW.ledger_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communication_logs_fill_tenancy_trigger ON communication_logs;

CREATE TRIGGER communication_logs_fill_tenancy_trigger
  BEFORE INSERT ON communication_logs
  FOR EACH ROW
  EXECUTE FUNCTION communication_logs_fill_tenancy();

COMMENT ON FUNCTION communication_logs_fill_tenancy IS
  'Backfills user_id/contact_id/business_id from the parent ledger so ledger-only inserts keep working.';

ALTER TABLE communication_logs
  ALTER COLUMN user_id SET NOT NULL;

-- channel defaults to 'whatsapp' for the backfill, which is wrong for the
-- historical voice and email rows.
UPDATE communication_logs
SET channel = CASE type
                WHEN 'vapi_call' THEN 'voice'::communication_channel
                WHEN 'email_invoice' THEN 'email'::communication_channel
                WHEN 'email_reminder' THEN 'email'::communication_channel
                ELSE 'whatsapp'::communication_channel
              END
WHERE type <> 'whatsapp_reminder';

-- Inbound customer messages belong to a contact, not to any single invoice.
ALTER TABLE communication_logs
  ALTER COLUMN ledger_id DROP NOT NULL;

-- Meta delivery receipts arrive keyed only by their message id, so this is the
-- lookup path for status transitions (sent -> delivered -> read).
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_logs_external_message_id
  ON communication_logs (external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communication_logs_contact_id
  ON communication_logs (contact_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_communication_logs_user_id
  ON communication_logs (user_id);

COMMENT ON COLUMN communication_logs.ledger_id IS
  'Nullable since 042: inbound replies and account-level messages map to a contact rather than one invoice.';

COMMENT ON COLUMN communication_logs.external_message_id IS
  'Provider message id (Meta wamid) used to reconcile asynchronous delivery receipts.';

COMMENT ON COLUMN communication_logs.summary IS
  'Short human-readable description for the audit timeline. Never store full message bodies here.';

-- Existing policies join through ledgers, which excludes the new
-- ledger-less rows. Scope directly on the denormalised user_id instead.
DROP POLICY IF EXISTS communication_logs_select_workspace ON communication_logs;
DROP POLICY IF EXISTS communication_logs_insert_workspace ON communication_logs;

CREATE POLICY communication_logs_select_workspace ON communication_logs
  FOR SELECT
  USING (can_manage_workspace(communication_logs.user_id));

CREATE POLICY communication_logs_insert_workspace ON communication_logs
  FOR INSERT
  WITH CHECK (can_manage_workspace(communication_logs.user_id));

CREATE POLICY communication_logs_update_workspace ON communication_logs
  FOR UPDATE
  USING (can_manage_workspace(communication_logs.user_id));

-- ---------------------------------------------------------------------------
-- Payment screenshot reconciliations (AI vision)
-- ---------------------------------------------------------------------------

CREATE TYPE reconciliation_status AS ENUM ('pending_review', 'approved', 'rejected');

CREATE TABLE reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses (id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts (id) ON DELETE CASCADE,
  ledger_id UUID REFERENCES ledgers (id) ON DELETE SET NULL,
  external_message_id TEXT,
  media_id TEXT,
  extracted_utr TEXT,
  extracted_amount NUMERIC(12, 2),
  extracted_date DATE,
  raw_extraction JSONB,
  status reconciliation_status NOT NULL DEFAULT 'pending_review',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reconciliations_user_status
  ON reconciliations (user_id, status);

CREATE INDEX idx_reconciliations_contact_id
  ON reconciliations (contact_id);

CREATE UNIQUE INDEX idx_reconciliations_external_message_id
  ON reconciliations (external_message_id)
  WHERE external_message_id IS NOT NULL;

COMMENT ON TABLE reconciliations IS
  'AI-extracted payment claims from customer screenshots. Never auto-settles a ledger; an owner must approve.';

COMMENT ON COLUMN reconciliations.raw_extraction IS
  'Unparsed model output, retained so a bad extraction can be audited after the fact.';

ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY reconciliations_select_workspace ON reconciliations
  FOR SELECT
  USING (can_manage_workspace(reconciliations.user_id));

CREATE POLICY reconciliations_insert_workspace ON reconciliations
  FOR INSERT
  WITH CHECK (can_manage_workspace(reconciliations.user_id));

CREATE POLICY reconciliations_update_workspace ON reconciliations
  FOR UPDATE
  USING (can_manage_workspace(reconciliations.user_id));
