-- P0 Hotfix: spend_funds permission for Razorpay / paid micro-transactions

ALTER TABLE workspace_members
  ALTER COLUMN custom_permissions SET DEFAULT '{
    "manage_team": false,
    "edit_settings": false,
    "edit_ledgers": false,
    "send_reminders": false,
    "export_data": false,
    "spend_funds": false
  }'::jsonb;

UPDATE workspace_members
SET custom_permissions = custom_permissions || '{"spend_funds": false}'::jsonb
WHERE NOT (custom_permissions ? 'spend_funds');

UPDATE workspace_members
SET custom_permissions = jsonb_set(custom_permissions, '{spend_funds}', 'true'::jsonb, true)
WHERE role = 'admin';

COMMENT ON COLUMN workspace_members.custom_permissions IS
  'Granular capability flags. spend_funds gates Razorpay micro-transactions; send_reminders is free messaging only.';
