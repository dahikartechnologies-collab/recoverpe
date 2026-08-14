-- Sprint 4: Core schema (Tables 2–7), balance trigger, and RLS
-- Depends on: 001_create_users_table.sql

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE ledger_source_type AS ENUM (
  'tally_import',
  'system_generated',
  'manual_entry'
);

CREATE TYPE ledger_status AS ENUM (
  'draft',
  'pending',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'refunded'
);

CREATE TYPE transaction_type AS ENUM (
  'payment_received',
  'refund_issued',
  'credit_note_applied',
  'bad_debt_writeoff'
);

CREATE TYPE payment_method AS ENUM (
  'upi_link',
  'cash_manual',
  'bank_transfer',
  'cheque',
  'system_adjustment'
);

CREATE TYPE communication_type AS ENUM (
  'whatsapp_reminder',
  'vapi_call',
  'email_invoice'
);

CREATE TYPE communication_status AS ENUM (
  'sent',
  'delivered',
  'read',
  'failed',
  'call_completed'
);

-- ---------------------------------------------------------------------------
-- Helper: resolve authenticated app user (Firebase hybrid + Supabase Auth)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.uid(),
    (
      SELECT u.id
      FROM public.users u
      WHERE u.firebase_uid = auth.jwt() ->> 'sub'
      LIMIT 1
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Table 2: businesses
-- ---------------------------------------------------------------------------

CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  gstin TEXT,
  logo_url TEXT,
  invoice_prefix TEXT,
  financial_year_suffix TEXT,
  next_invoice_sequence INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_businesses_user_id ON businesses (user_id);

-- ---------------------------------------------------------------------------
-- Table 3: contacts
-- ---------------------------------------------------------------------------

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  client_gstin TEXT,
  billing_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_user_id ON contacts (user_id);

-- ---------------------------------------------------------------------------
-- Table 4: ledgers
-- ---------------------------------------------------------------------------

CREATE TABLE ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts (id) ON DELETE RESTRICT,
  business_id UUID REFERENCES businesses (id) ON DELETE SET NULL,
  invoice_number TEXT,
  source_type ledger_source_type NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  balance_due NUMERIC(12, 2) NOT NULL CHECK (balance_due >= 0),
  due_date DATE NOT NULL,
  status ledger_status NOT NULL DEFAULT 'pending',
  is_custom_pdf BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_url TEXT,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledgers_user_id ON ledgers (user_id);
CREATE INDEX idx_ledgers_contact_id ON ledgers (contact_id);
CREATE INDEX idx_ledgers_business_id ON ledgers (business_id);
CREATE INDEX idx_ledgers_status ON ledgers (status);
CREATE INDEX idx_ledgers_due_date ON ledgers (due_date);

-- ---------------------------------------------------------------------------
-- Table 5: ledger_revisions
-- ---------------------------------------------------------------------------

CREATE TABLE ledger_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id UUID NOT NULL REFERENCES ledgers (id) ON DELETE CASCADE,
  previous_total_amount NUMERIC(12, 2) NOT NULL,
  previous_pdf_url TEXT,
  version_number INTEGER NOT NULL,
  rectification_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_revisions_ledger_id ON ledger_revisions (ledger_id);

-- ---------------------------------------------------------------------------
-- Table 6: transactions
-- ---------------------------------------------------------------------------

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id UUID NOT NULL REFERENCES ledgers (id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method payment_method NOT NULL,
  reference_id TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_ledger_id ON transactions (ledger_id);
CREATE INDEX idx_transactions_logged_at ON transactions (logged_at);

-- ---------------------------------------------------------------------------
-- Table 7: communication_logs
-- ---------------------------------------------------------------------------

CREATE TABLE communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id UUID NOT NULL REFERENCES ledgers (id) ON DELETE CASCADE,
  type communication_type NOT NULL,
  status communication_status NOT NULL,
  cost_deducted NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_communication_logs_ledger_id ON communication_logs (ledger_id);
CREATE INDEX idx_communication_logs_executed_at ON communication_logs (executed_at);

-- ---------------------------------------------------------------------------
-- Triggers: ledger balance integrity
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_initial_ledger_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.balance_due IS NULL THEN
    NEW.balance_due := NEW.total_amount;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ledgers_set_initial_balance
BEFORE INSERT ON ledgers
FOR EACH ROW
EXECUTE FUNCTION public.set_initial_ledger_balance();

CREATE OR REPLACE FUNCTION public.calculate_balance_due()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ledger_total NUMERIC(12, 2);
  applied_sum NUMERIC(12, 2);
  new_balance NUMERIC(12, 2);
  ledger_due_date DATE;
BEGIN
  SELECT total_amount, due_date
  INTO ledger_total, ledger_due_date
  FROM ledgers
  WHERE id = NEW.ledger_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO applied_sum
  FROM transactions
  WHERE ledger_id = NEW.ledger_id;

  new_balance := GREATEST(ledger_total - applied_sum, 0);

  UPDATE ledgers
  SET
    balance_due = new_balance,
    status = CASE
      WHEN new_balance <= 0 THEN 'paid'::ledger_status
      WHEN applied_sum > 0 AND new_balance > 0 THEN 'partially_paid'::ledger_status
      WHEN ledger_due_date < CURRENT_DATE AND new_balance > 0 THEN 'overdue'::ledger_status
      ELSE 'pending'::ledger_status
    END,
    updated_at = NOW()
  WHERE id = NEW.ledger_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transactions_calculate_balance_due
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_balance_due();

CREATE OR REPLACE FUNCTION public.touch_ledger_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ledgers_touch_updated_at
BEFORE UPDATE ON ledgers
FOR EACH ROW
EXECUTE FUNCTION public.touch_ledger_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

-- users (Table 1) policies
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (id = auth_user_id());

CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (id = auth_user_id())
  WITH CHECK (id = auth_user_id());

-- businesses
CREATE POLICY businesses_select_own ON businesses
  FOR SELECT
  USING (user_id = auth_user_id());

CREATE POLICY businesses_insert_own ON businesses
  FOR INSERT
  WITH CHECK (user_id = auth_user_id());

CREATE POLICY businesses_update_own ON businesses
  FOR UPDATE
  USING (user_id = auth_user_id())
  WITH CHECK (user_id = auth_user_id());

CREATE POLICY businesses_delete_own ON businesses
  FOR DELETE
  USING (user_id = auth_user_id());

-- contacts
CREATE POLICY contacts_select_own ON contacts
  FOR SELECT
  USING (user_id = auth_user_id());

CREATE POLICY contacts_insert_own ON contacts
  FOR INSERT
  WITH CHECK (user_id = auth_user_id());

CREATE POLICY contacts_update_own ON contacts
  FOR UPDATE
  USING (user_id = auth_user_id())
  WITH CHECK (user_id = auth_user_id());

CREATE POLICY contacts_delete_own ON contacts
  FOR DELETE
  USING (user_id = auth_user_id());

-- ledgers
CREATE POLICY ledgers_select_own ON ledgers
  FOR SELECT
  USING (user_id = auth_user_id());

CREATE POLICY ledgers_insert_own ON ledgers
  FOR INSERT
  WITH CHECK (user_id = auth_user_id());

CREATE POLICY ledgers_update_own ON ledgers
  FOR UPDATE
  USING (user_id = auth_user_id())
  WITH CHECK (user_id = auth_user_id());

CREATE POLICY ledgers_delete_own ON ledgers
  FOR DELETE
  USING (user_id = auth_user_id());

-- ledger_revisions (via ledger ownership)
CREATE POLICY ledger_revisions_select_own ON ledger_revisions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = ledger_revisions.ledger_id
        AND l.user_id = auth_user_id()
    )
  );

CREATE POLICY ledger_revisions_insert_own ON ledger_revisions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = ledger_revisions.ledger_id
        AND l.user_id = auth_user_id()
    )
  );

-- transactions (via ledger ownership)
CREATE POLICY transactions_select_own ON transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = transactions.ledger_id
        AND l.user_id = auth_user_id()
    )
  );

CREATE POLICY transactions_insert_own ON transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = transactions.ledger_id
        AND l.user_id = auth_user_id()
    )
  );

-- communication_logs (via ledger ownership)
CREATE POLICY communication_logs_select_own ON communication_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = communication_logs.ledger_id
        AND l.user_id = auth_user_id()
    )
  );

CREATE POLICY communication_logs_insert_own ON communication_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = communication_logs.ledger_id
        AND l.user_id = auth_user_id()
    )
  );

COMMENT ON FUNCTION public.calculate_balance_due IS
  'Recalculates ledgers.balance_due and status after each transaction insert';
