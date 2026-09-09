-- Sprint 43: Granular workspace permission matrix (JSONB on workspace_members)

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB NOT NULL DEFAULT '{
    "manage_team": false,
    "edit_settings": false,
    "edit_ledgers": false,
    "send_reminders": false,
    "export_data": false,
    "spend_funds": false
  }'::jsonb;

COMMENT ON COLUMN workspace_members.custom_permissions IS
  'Granular capability flags for invited roles. Workspace owners always have full access in application logic.';

-- Backfill sensible defaults for existing accepted members by role template
UPDATE workspace_members
SET custom_permissions = '{
  "manage_team": true,
  "edit_settings": true,
  "edit_ledgers": true,
  "send_reminders": true,
  "export_data": true,
  "spend_funds": true
}'::jsonb
WHERE role = 'admin';

UPDATE workspace_members
SET custom_permissions = '{
  "manage_team": false,
  "edit_settings": false,
  "edit_ledgers": false,
  "send_reminders": true,
  "export_data": false
}'::jsonb
WHERE role = 'recovery_agent';

UPDATE workspace_members
SET custom_permissions = '{
  "manage_team": false,
  "edit_settings": false,
  "edit_ledgers": false,
  "send_reminders": false,
  "export_data": true
}'::jsonb
WHERE role = 'accountant';
