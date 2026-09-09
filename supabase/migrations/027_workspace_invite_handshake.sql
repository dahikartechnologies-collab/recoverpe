-- Sprint 41: Workspace invitation handshake (pending / accepted / rejected)

CREATE TYPE workspace_member_status AS ENUM ('pending', 'accepted', 'rejected');

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS status workspace_member_status,
  ADD COLUMN IF NOT EXISTS invitee_name TEXT;

UPDATE workspace_members
SET status = 'accepted'
WHERE status IS NULL;

ALTER TABLE workspace_members
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_members_member_pending
  ON workspace_members (member_user_id, status)
  WHERE status = 'pending';

COMMENT ON COLUMN workspace_members.status IS
  'Invitation lifecycle: pending until invitee accepts or rejects.';
COMMENT ON COLUMN workspace_members.invitee_name IS
  'Display name supplied by the workspace owner when sending the invite.';

-- Only accepted members receive workspace RBAC
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
        AND wm.status = 'accepted'
      LIMIT 1
    )
  END;
$$;

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
      AND wm.status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'assigned_to_user_id must be an active field_staff member of this workspace.';
  END IF;

  RETURN NEW;
END;
$$;
