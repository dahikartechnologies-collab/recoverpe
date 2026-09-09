-- Sprint 40 (part 2): RBAC helpers + internal ledger notes
-- Depends on: 025_enterprise_rbac_notes.sql (enum values must be committed first)

ALTER TABLE workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_invited_role;

ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_invited_role CHECK (
    role IN ('admin', 'field_staff', 'recovery_agent', 'accountant')
  );

COMMENT ON TABLE workspace_members IS
  'Maps invited staff to a workspace. Owner is implicit via users.id; invited roles exclude owner.';

CREATE OR REPLACE FUNCTION public.is_accountant_for(p_workspace_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_role(p_workspace_user_id) = 'accountant'::app_role;
$$;

CREATE OR REPLACE FUNCTION public.is_recovery_agent_for(p_workspace_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_role(p_workspace_user_id) = 'recovery_agent'::app_role;
$$;

CREATE OR REPLACE FUNCTION public.can_mutate_workspace(p_workspace_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_role(p_workspace_user_id) IN (
    'owner'::app_role,
    'admin'::app_role,
    'recovery_agent'::app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(p_workspace_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_role(p_workspace_user_id) IN (
    'owner'::app_role,
    'admin'::app_role
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
        can_mutate_workspace(l.user_id)
        OR (
          is_field_staff_for(l.user_id)
          AND l.assigned_to_user_id = auth_user_id()
        )
      )
  );
$$;

CREATE TABLE IF NOT EXISTS ledger_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id UUID NOT NULL REFERENCES ledgers (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  note_text TEXT NOT NULL CHECK (char_length(btrim(note_text)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_notes_ledger_id ON ledger_notes (ledger_id);
CREATE INDEX IF NOT EXISTS idx_ledger_notes_created_at ON ledger_notes (created_at DESC);

COMMENT ON TABLE ledger_notes IS
  'Internal team comments on a ledger. Visible to workspace members with ledger access.';

ALTER TABLE ledger_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_notes_select ON ledger_notes;
DROP POLICY IF EXISTS ledger_notes_insert ON ledger_notes;

CREATE POLICY ledger_notes_select ON ledger_notes
  FOR SELECT
  USING (ledger_readable(ledger_id));

CREATE POLICY ledger_notes_insert ON ledger_notes
  FOR INSERT
  WITH CHECK (
    user_id = auth_user_id()
    AND EXISTS (
      SELECT 1
      FROM ledgers l
      WHERE l.id = ledger_id
        AND ledger_readable(l.id)
        AND NOT is_accountant_for(l.user_id)
    )
  );
