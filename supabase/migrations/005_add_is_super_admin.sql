-- Sprint 12: Super Admin flag on users

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_is_super_admin
ON users (is_super_admin)
WHERE is_super_admin = TRUE;

COMMENT ON COLUMN users.is_super_admin IS
  'When true, user can access the Recoverpe Super Admin control room';
