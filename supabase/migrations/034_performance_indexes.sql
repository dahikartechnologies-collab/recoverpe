-- Sprint 51: Performance indexes for dashboard, vendor, and workspace hot paths

-- ledgers: FK filters, FIFO ordering, and status scans
CREATE INDEX IF NOT EXISTS idx_ledgers_contact_id ON ledgers (contact_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_business_id ON ledgers (business_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_created_at ON ledgers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledgers_status ON ledgers (status);
CREATE INDEX IF NOT EXISTS idx_ledgers_contact_open_created
  ON ledgers (contact_id, created_at ASC)
  WHERE balance_due > 0
    AND status NOT IN ('paid', 'cancelled', 'refunded');

-- contacts: workspace scoping and wallet lookups
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_wallet_balance
  ON contacts (user_id, wallet_balance DESC);

-- workspace_members: membership resolution and invite inbox
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_user_id
  ON workspace_members (workspace_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_member_user_id
  ON workspace_members (member_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_status ON workspace_members (status);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_status
  ON workspace_members (workspace_user_id, status);

-- transactions: ledger reconciliation and contact-scoped analytics via denormalized contact_id
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts (id) ON DELETE SET NULL;

UPDATE transactions AS t
SET contact_id = l.contact_id
FROM ledgers AS l
WHERE l.id = t.ledger_id
  AND t.contact_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_ledger_id ON transactions (ledger_id);
CREATE INDEX IF NOT EXISTS idx_transactions_contact_id ON transactions (contact_id);

CREATE OR REPLACE FUNCTION public.sync_transaction_contact_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contact_id IS NULL THEN
    SELECT contact_id
    INTO NEW.contact_id
    FROM ledgers
    WHERE id = NEW.ledger_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_sync_contact_id ON transactions;

CREATE TRIGGER trg_transactions_sync_contact_id
BEFORE INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_transaction_contact_id();
