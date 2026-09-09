-- Sprint 31: Enterprise AR OS — Smart Collect, Evidence Vault, Debtor Portal, RBAC
-- Depends on: 001–017
-- Run in Supabase SQL Editor after prior migrations.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE app_role AS ENUM ('owner', 'admin', 'field_staff');

CREATE TYPE payment_provider AS ENUM ('razorpay', 'cashfree');

CREATE TYPE virtual_account_status AS ENUM ('active', 'suspended', 'closed');

CREATE TYPE inbound_payment_status AS ENUM (
  'received',
  'processing',
  'allocated',
  'partially_allocated',
  'failed',
  'duplicate'
);

CREATE TYPE evidence_file_type AS ENUM (
  'POD',
  'Contract',
  'Photo',
  'Invoice',
  'Other'
);

-- ---------------------------------------------------------------------------
-- RBAC: workspace membership (owner is implicit via users.id ownership)
-- ---------------------------------------------------------------------------

CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role app_role NOT NULL,
  invited_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_members_not_self CHECK (workspace_user_id <> member_user_id),
  CONSTRAINT workspace_members_invited_role CHECK (role IN ('admin', 'field_staff')),
  CONSTRAINT workspace_members_unique_pair UNIQUE (workspace_user_id, member_user_id)
);

CREATE INDEX idx_workspace_members_workspace_user_id
  ON workspace_members (workspace_user_id);

CREATE INDEX idx_workspace_members_member_user_id
  ON workspace_members (member_user_id);

COMMENT ON TABLE workspace_members IS
  'Maps invited staff to a workspace. The account owner is implicit (users.id); only admin and field_staff rows live here.';

-- Field staff ledger assignment (kiosk / route collection)
ALTER TABLE ledgers
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ledgers_assigned_to_user_id
  ON ledgers (assigned_to_user_id)
  WHERE assigned_to_user_id IS NOT NULL;

COMMENT ON COLUMN ledgers.assigned_to_user_id IS
  'Optional field_staff member assigned to collect on this ledger.';

-- Audit trail for cash collection logged by kiosk users
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS logged_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inbound_payment_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_logged_by_user_id
  ON transactions (logged_by_user_id)
  WHERE logged_by_user_id IS NOT NULL;

COMMENT ON COLUMN transactions.logged_by_user_id IS
  'Authenticated user who recorded the transaction (field_staff kiosk mode).';

-- ---------------------------------------------------------------------------
-- Smart Collect: virtual accounts
-- ---------------------------------------------------------------------------

CREATE TABLE virtual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  provider payment_provider NOT NULL,
  virtual_upi_id TEXT,
  virtual_account_number TEXT,
  ifsc_code TEXT,
  provider_reference_id TEXT,
  status virtual_account_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT virtual_accounts_identity_present CHECK (
    NULLIF(BTRIM(virtual_upi_id), '') IS NOT NULL
    OR (
      NULLIF(BTRIM(virtual_account_number), '') IS NOT NULL
      AND NULLIF(BTRIM(ifsc_code), '') IS NOT NULL
    )
  ),
  CONSTRAINT virtual_accounts_unique_per_contact_business UNIQUE (business_id, contact_id)
);

CREATE UNIQUE INDEX idx_virtual_accounts_upi_id
  ON virtual_accounts (virtual_upi_id)
  WHERE virtual_upi_id IS NOT NULL;

CREATE UNIQUE INDEX idx_virtual_accounts_bank_identity
  ON virtual_accounts (virtual_account_number, ifsc_code)
  WHERE virtual_account_number IS NOT NULL AND ifsc_code IS NOT NULL;

CREATE INDEX idx_virtual_accounts_user_id ON virtual_accounts (user_id);
CREATE INDEX idx_virtual_accounts_contact_id ON virtual_accounts (contact_id);

COMMENT ON TABLE virtual_accounts IS
  'Per-contact Smart Collect virtual account (UPI VPA and/or NEFT bank VA) for auto-reconciliation.';

-- ---------------------------------------------------------------------------
-- Smart Collect: inbound payment webhooks (idempotent)
-- ---------------------------------------------------------------------------

CREATE TABLE inbound_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  virtual_account_id UUID REFERENCES virtual_accounts (id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses (id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts (id) ON DELETE SET NULL,
  provider payment_provider NOT NULL,
  external_event_id TEXT NOT NULL,
  external_payment_id TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  raw_payload JSONB NOT NULL,
  status inbound_payment_status NOT NULL DEFAULT 'received',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inbound_payments_provider_event_unique UNIQUE (provider, external_event_id)
);

CREATE INDEX idx_inbound_payments_user_id ON inbound_payments (user_id);
CREATE INDEX idx_inbound_payments_virtual_account_id ON inbound_payments (virtual_account_id);
CREATE INDEX idx_inbound_payments_contact_id ON inbound_payments (contact_id);
CREATE INDEX idx_inbound_payments_status ON inbound_payments (status);
CREATE INDEX idx_inbound_payments_received_at ON inbound_payments (received_at DESC);

COMMENT ON TABLE inbound_payments IS
  'Raw, idempotent webhook events from Razorpay/Cashfree Smart Collect before ledger allocation.';

-- Link auto-reconciled transactions back to inbound payments
ALTER TABLE transactions
  ADD CONSTRAINT transactions_inbound_payment_id_fkey
  FOREIGN KEY (inbound_payment_id) REFERENCES inbound_payments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_inbound_payment_id
  ON transactions (inbound_payment_id)
  WHERE inbound_payment_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Smart Collect: payment allocations (partial / multi-invoice)
-- ---------------------------------------------------------------------------

CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_payment_id UUID NOT NULL REFERENCES inbound_payments (id) ON DELETE CASCADE,
  ledger_id UUID NOT NULL REFERENCES ledgers (id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0),
  allocation_sequence SMALLINT NOT NULL DEFAULT 1 CHECK (allocation_sequence > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_allocations_unique_ledger_per_payment UNIQUE (inbound_payment_id, ledger_id)
);

CREATE INDEX idx_payment_allocations_inbound_payment_id
  ON payment_allocations (inbound_payment_id);

CREATE INDEX idx_payment_allocations_ledger_id
  ON payment_allocations (ledger_id);

COMMENT ON TABLE payment_allocations IS
  'Maps one inbound payment to one or more ledgers (oldest-first partial settlement).';

-- ---------------------------------------------------------------------------
-- Evidence Vault
-- ---------------------------------------------------------------------------

CREATE TABLE evidence_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id UUID NOT NULL REFERENCES ledgers (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type evidence_file_type NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT evidence_attachments_file_name_nonempty CHECK (BTRIM(file_name) <> ''),
  CONSTRAINT evidence_attachments_storage_path_nonempty CHECK (BTRIM(storage_path) <> '')
);

CREATE INDEX idx_evidence_attachments_ledger_id ON evidence_attachments (ledger_id);
CREATE INDEX idx_evidence_attachments_user_id ON evidence_attachments (user_id);
CREATE INDEX idx_evidence_attachments_file_type ON evidence_attachments (file_type);

COMMENT ON TABLE evidence_attachments IS
  'Proof-of-delivery and contract files attached to ledgers for legal notice bundling.';

-- ---------------------------------------------------------------------------
-- Secure debtor portal sessions (token = primary key UUID)
-- ---------------------------------------------------------------------------

CREATE TABLE debtor_portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  CONSTRAINT debtor_portal_sessions_expires_after_create CHECK (expires_at > created_at)
);

CREATE INDEX idx_debtor_portal_sessions_contact_id ON debtor_portal_sessions (contact_id);
CREATE INDEX idx_debtor_portal_sessions_user_id ON debtor_portal_sessions (user_id);

CREATE INDEX idx_debtor_portal_sessions_active
  ON debtor_portal_sessions (id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE debtor_portal_sessions IS
  'Time-limited portal tokens (/portal/[uuid]) for read-only debtor ledger access via WhatsApp links.';

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_virtual_account_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_virtual_accounts_touch_updated_at
BEFORE UPDATE ON virtual_accounts
FOR EACH ROW
EXECUTE FUNCTION public.touch_virtual_account_updated_at();

CREATE OR REPLACE FUNCTION public.validate_virtual_account_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  business_owner UUID;
  contact_owner UUID;
BEGIN
  SELECT b.user_id INTO business_owner
  FROM businesses b
  WHERE b.id = NEW.business_id;

  SELECT c.user_id INTO contact_owner
  FROM contacts c
  WHERE c.id = NEW.contact_id;

  IF business_owner IS NULL OR contact_owner IS NULL THEN
    RAISE EXCEPTION 'Virtual account references missing business or contact.';
  END IF;

  IF business_owner IS DISTINCT FROM contact_owner THEN
    RAISE EXCEPTION 'Business and contact must belong to the same workspace owner.';
  END IF;

  IF NEW.user_id IS DISTINCT FROM business_owner THEN
    RAISE EXCEPTION 'virtual_accounts.user_id must match business/contact owner.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_virtual_accounts_validate_scope
BEFORE INSERT OR UPDATE ON virtual_accounts
FOR EACH ROW
EXECUTE FUNCTION public.validate_virtual_account_scope();

CREATE OR REPLACE FUNCTION public.validate_inbound_payment_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  va_user_id UUID;
BEGIN
  IF NEW.virtual_account_id IS NOT NULL THEN
    SELECT va.user_id
    INTO va_user_id
    FROM virtual_accounts va
    WHERE va.id = NEW.virtual_account_id;

    IF va_user_id IS NULL THEN
      RAISE EXCEPTION 'Virtual account not found for inbound payment.';
    END IF;

    IF NEW.user_id IS DISTINCT FROM va_user_id THEN
      RAISE EXCEPTION 'inbound_payments.user_id must match virtual account owner.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inbound_payments_validate_scope
BEFORE INSERT OR UPDATE ON inbound_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_inbound_payment_scope();

CREATE OR REPLACE FUNCTION public.validate_payment_allocation_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  payment_user_id UUID;
  ledger_owner_id UUID;
  payment_amount NUMERIC(12, 2);
  allocated_total NUMERIC(12, 2);
BEGIN
  SELECT ip.user_id, ip.amount
  INTO payment_user_id, payment_amount
  FROM inbound_payments ip
  WHERE ip.id = NEW.inbound_payment_id;

  SELECT l.user_id
  INTO ledger_owner_id
  FROM ledgers l
  WHERE l.id = NEW.ledger_id;

  IF payment_user_id IS NULL OR ledger_owner_id IS NULL THEN
    RAISE EXCEPTION 'Payment allocation references missing payment or ledger.';
  END IF;

  IF payment_user_id IS DISTINCT FROM ledger_owner_id THEN
    RAISE EXCEPTION 'Payment and ledger must belong to the same workspace owner.';
  END IF;

  SELECT COALESCE(SUM(pa.allocated_amount), 0)
  INTO allocated_total
  FROM payment_allocations pa
  WHERE pa.inbound_payment_id = NEW.inbound_payment_id
    AND pa.id IS DISTINCT FROM NEW.id;

  IF allocated_total + NEW.allocated_amount > payment_amount THEN
    RAISE EXCEPTION 'Total allocations cannot exceed inbound payment amount.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_allocations_validate_scope
BEFORE INSERT OR UPDATE ON payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.validate_payment_allocation_scope();

CREATE OR REPLACE FUNCTION public.validate_evidence_attachment_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ledger_owner_id UUID;
BEGIN
  SELECT l.user_id
  INTO ledger_owner_id
  FROM ledgers l
  WHERE l.id = NEW.ledger_id;

  IF ledger_owner_id IS NULL THEN
    RAISE EXCEPTION 'Evidence attachment references missing ledger.';
  END IF;

  IF NEW.user_id IS DISTINCT FROM ledger_owner_id THEN
    RAISE EXCEPTION 'evidence_attachments.user_id must match ledger owner.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evidence_attachments_validate_scope
BEFORE INSERT OR UPDATE ON evidence_attachments
FOR EACH ROW
EXECUTE FUNCTION public.validate_evidence_attachment_scope();

CREATE OR REPLACE FUNCTION public.validate_debtor_portal_session_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  contact_owner_id UUID;
BEGIN
  SELECT c.user_id
  INTO contact_owner_id
  FROM contacts c
  WHERE c.id = NEW.contact_id;

  IF contact_owner_id IS NULL THEN
    RAISE EXCEPTION 'Debtor portal session references missing contact.';
  END IF;

  IF NEW.user_id IS DISTINCT FROM contact_owner_id THEN
    RAISE EXCEPTION 'debtor_portal_sessions.user_id must match contact owner.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_debtor_portal_sessions_validate_scope
BEFORE INSERT OR UPDATE ON debtor_portal_sessions
FOR EACH ROW
EXECUTE FUNCTION public.validate_debtor_portal_session_scope();

CREATE OR REPLACE FUNCTION public.validate_ledger_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.assigned_to_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to_user_id = NEW.user_id THEN
    RAISE EXCEPTION 'Workspace owner cannot be assigned as field_staff on their own ledger.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM workspace_members wm
    WHERE wm.workspace_user_id = NEW.user_id
      AND wm.member_user_id = NEW.assigned_to_user_id
      AND wm.role = 'field_staff'
  ) THEN
    RAISE EXCEPTION 'assigned_to_user_id must be an active field_staff member of this workspace.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ledgers_validate_assignment
BEFORE INSERT OR UPDATE OF assigned_to_user_id ON ledgers
FOR EACH ROW
EXECUTE FUNCTION public.validate_ledger_assignment();

CREATE OR REPLACE FUNCTION public.set_transaction_logged_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.logged_by_user_id IS NULL THEN
    NEW.logged_by_user_id := auth_user_id();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transactions_set_logged_by
BEFORE INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_transaction_logged_by();

-- ---------------------------------------------------------------------------
-- RBAC helper functions (used by RLS policies)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.workspace_role(p_workspace_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth_user_id() IS NULL THEN NULL::app_role
    WHEN auth_user_id() = p_workspace_user_id THEN 'owner'::app_role
    ELSE (
      SELECT wm.role
      FROM workspace_members wm
      WHERE wm.workspace_user_id = p_workspace_user_id
        AND wm.member_user_id = auth_user_id()
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_workspace(p_workspace_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_role(p_workspace_user_id) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(p_workspace_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_role(p_workspace_user_id) IN ('owner', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_field_staff_for(p_workspace_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_role(p_workspace_user_id) = 'field_staff';
$$;

CREATE OR REPLACE FUNCTION public.ledger_readable(p_ledger_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM ledgers l
    WHERE l.id = p_ledger_id
      AND (
        l.user_id = auth_user_id()
        OR (
          can_access_workspace(l.user_id)
          AND (
            NOT is_field_staff_for(l.user_id)
            OR l.assigned_to_user_id = auth_user_id()
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.ledger_collectible(p_ledger_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM ledgers l
    WHERE l.id = p_ledger_id
      AND (
        can_manage_workspace(l.user_id)
        OR (
          is_field_staff_for(l.user_id)
          AND l.assigned_to_user_id = auth_user_id()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security — new tables
-- ---------------------------------------------------------------------------

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtor_portal_sessions ENABLE ROW LEVEL SECURITY;

-- workspace_members
CREATE POLICY workspace_members_select ON workspace_members
  FOR SELECT
  USING (
    workspace_user_id = auth_user_id()
    OR member_user_id = auth_user_id()
  );

CREATE POLICY workspace_members_insert ON workspace_members
  FOR INSERT
  WITH CHECK (can_manage_workspace(workspace_user_id));

CREATE POLICY workspace_members_update ON workspace_members
  FOR UPDATE
  USING (can_manage_workspace(workspace_user_id))
  WITH CHECK (can_manage_workspace(workspace_user_id));

CREATE POLICY workspace_members_delete ON workspace_members
  FOR DELETE
  USING (can_manage_workspace(workspace_user_id));

-- virtual_accounts (owner/admin only)
CREATE POLICY virtual_accounts_select ON virtual_accounts
  FOR SELECT
  USING (can_manage_workspace(user_id));

CREATE POLICY virtual_accounts_insert ON virtual_accounts
  FOR INSERT
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY virtual_accounts_update ON virtual_accounts
  FOR UPDATE
  USING (can_manage_workspace(user_id))
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY virtual_accounts_delete ON virtual_accounts
  FOR DELETE
  USING (can_manage_workspace(user_id));

-- inbound_payments (owner/admin only; webhooks use service role)
CREATE POLICY inbound_payments_select ON inbound_payments
  FOR SELECT
  USING (can_manage_workspace(user_id));

CREATE POLICY inbound_payments_insert ON inbound_payments
  FOR INSERT
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY inbound_payments_update ON inbound_payments
  FOR UPDATE
  USING (can_manage_workspace(user_id))
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY inbound_payments_delete ON inbound_payments
  FOR DELETE
  USING (can_manage_workspace(user_id));

-- payment_allocations (owner/admin only)
CREATE POLICY payment_allocations_select ON payment_allocations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM inbound_payments ip
      WHERE ip.id = payment_allocations.inbound_payment_id
        AND can_manage_workspace(ip.user_id)
    )
  );

CREATE POLICY payment_allocations_insert ON payment_allocations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM inbound_payments ip
      WHERE ip.id = payment_allocations.inbound_payment_id
        AND can_manage_workspace(ip.user_id)
    )
  );

CREATE POLICY payment_allocations_update ON payment_allocations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM inbound_payments ip
      WHERE ip.id = payment_allocations.inbound_payment_id
        AND can_manage_workspace(ip.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM inbound_payments ip
      WHERE ip.id = payment_allocations.inbound_payment_id
        AND can_manage_workspace(ip.user_id)
    )
  );

CREATE POLICY payment_allocations_delete ON payment_allocations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM inbound_payments ip
      WHERE ip.id = payment_allocations.inbound_payment_id
        AND can_manage_workspace(ip.user_id)
    )
  );

-- evidence_attachments
CREATE POLICY evidence_attachments_select ON evidence_attachments
  FOR SELECT
  USING (ledger_readable(ledger_id));

CREATE POLICY evidence_attachments_insert ON evidence_attachments
  FOR INSERT
  WITH CHECK (
    ledger_collectible(ledger_id)
    AND user_id = (SELECT l.user_id FROM ledgers l WHERE l.id = ledger_id)
  );

CREATE POLICY evidence_attachments_update ON evidence_attachments
  FOR UPDATE
  USING (can_manage_workspace(user_id))
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY evidence_attachments_delete ON evidence_attachments
  FOR DELETE
  USING (can_manage_workspace(user_id));

-- debtor_portal_sessions (owner/admin manage tokens)
CREATE POLICY debtor_portal_sessions_select ON debtor_portal_sessions
  FOR SELECT
  USING (can_manage_workspace(user_id));

CREATE POLICY debtor_portal_sessions_insert ON debtor_portal_sessions
  FOR INSERT
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY debtor_portal_sessions_update ON debtor_portal_sessions
  FOR UPDATE
  USING (can_manage_workspace(user_id))
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY debtor_portal_sessions_delete ON debtor_portal_sessions
  FOR DELETE
  USING (can_manage_workspace(user_id));

-- ---------------------------------------------------------------------------
-- Row Level Security — upgrade core tables for RBAC
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS ledgers_select_own ON ledgers;
DROP POLICY IF EXISTS ledgers_insert_own ON ledgers;
DROP POLICY IF EXISTS ledgers_update_own ON ledgers;
DROP POLICY IF EXISTS ledgers_delete_own ON ledgers;

CREATE POLICY ledgers_select_workspace ON ledgers
  FOR SELECT
  USING (
    user_id = auth_user_id()
    OR (
      can_access_workspace(user_id)
      AND (
        NOT is_field_staff_for(user_id)
        OR assigned_to_user_id = auth_user_id()
      )
    )
  );

CREATE POLICY ledgers_insert_workspace ON ledgers
  FOR INSERT
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY ledgers_update_workspace ON ledgers
  FOR UPDATE
  USING (can_manage_workspace(user_id))
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY ledgers_delete_workspace ON ledgers
  FOR DELETE
  USING (can_manage_workspace(user_id));

DROP POLICY IF EXISTS transactions_select_own ON transactions;
DROP POLICY IF EXISTS transactions_insert_own ON transactions;

CREATE POLICY transactions_select_workspace ON transactions
  FOR SELECT
  USING (ledger_readable(ledger_id));

CREATE POLICY transactions_insert_workspace ON transactions
  FOR INSERT
  WITH CHECK (ledger_collectible(ledger_id));

DROP POLICY IF EXISTS communication_logs_select_own ON communication_logs;
DROP POLICY IF EXISTS communication_logs_insert_own ON communication_logs;

CREATE POLICY communication_logs_select_workspace ON communication_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = communication_logs.ledger_id
        AND can_manage_workspace(l.user_id)
    )
  );

CREATE POLICY communication_logs_insert_workspace ON communication_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = communication_logs.ledger_id
        AND can_manage_workspace(l.user_id)
    )
  );

-- businesses & contacts: owner/admin only (field_staff access ledgers via assignment)
DROP POLICY IF EXISTS businesses_select_own ON businesses;
DROP POLICY IF EXISTS businesses_insert_own ON businesses;
DROP POLICY IF EXISTS businesses_update_own ON businesses;
DROP POLICY IF EXISTS businesses_delete_own ON businesses;

CREATE POLICY businesses_select_workspace ON businesses
  FOR SELECT
  USING (can_manage_workspace(user_id));

CREATE POLICY businesses_insert_workspace ON businesses
  FOR INSERT
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY businesses_update_workspace ON businesses
  FOR UPDATE
  USING (can_manage_workspace(user_id))
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY businesses_delete_workspace ON businesses
  FOR DELETE
  USING (can_manage_workspace(user_id));

DROP POLICY IF EXISTS contacts_select_own ON contacts;
DROP POLICY IF EXISTS contacts_insert_own ON contacts;
DROP POLICY IF EXISTS contacts_update_own ON contacts;
DROP POLICY IF EXISTS contacts_delete_own ON contacts;

CREATE POLICY contacts_select_workspace ON contacts
  FOR SELECT
  USING (can_manage_workspace(user_id));

CREATE POLICY contacts_insert_workspace ON contacts
  FOR INSERT
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY contacts_update_workspace ON contacts
  FOR UPDATE
  USING (can_manage_workspace(user_id))
  WITH CHECK (can_manage_workspace(user_id));

CREATE POLICY contacts_delete_workspace ON contacts
  FOR DELETE
  USING (can_manage_workspace(user_id));

DROP POLICY IF EXISTS ledger_revisions_select_own ON ledger_revisions;
DROP POLICY IF EXISTS ledger_revisions_insert_own ON ledger_revisions;

CREATE POLICY ledger_revisions_select_workspace ON ledger_revisions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = ledger_revisions.ledger_id
        AND ledger_readable(l.id)
    )
  );

CREATE POLICY ledger_revisions_insert_workspace ON ledger_revisions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = ledger_revisions.ledger_id
        AND can_manage_workspace(l.user_id)
    )
  );

COMMENT ON FUNCTION public.workspace_role IS
  'Resolves effective app_role for auth_user_id() within a workspace (owner is implicit).';

COMMENT ON FUNCTION public.ledger_readable IS
  'True when caller may read a ledger: owner/admin (all) or field_staff (assigned only).';

COMMENT ON FUNCTION public.ledger_collectible IS
  'True when caller may log collections: owner/admin (all) or field_staff (assigned only).';
