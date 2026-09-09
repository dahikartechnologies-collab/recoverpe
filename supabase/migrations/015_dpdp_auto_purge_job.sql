-- Sprint 26: DPDP auto-wipe for accounts scheduled deletion (30-day grace period).
-- Cascading deletes on users(id) already remove linked businesses, contacts,
-- ledgers, communication_logs (via ledgers), razorpay_orders, and subscriptions.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN users.updated_at IS
  'Last profile mutation; pending_purge clock starts when status changes to pending_purge.';

CREATE OR REPLACE FUNCTION public.touch_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_touch_updated_at ON users;

CREATE TRIGGER trg_users_touch_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION public.touch_users_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_pending_purge_updated_at
  ON users (updated_at)
  WHERE account_status = 'pending_purge';

-- Permanently delete users whose 30-day DPDP grace period has elapsed.
CREATE OR REPLACE FUNCTION public.purge_pending_purge_users()
RETURNS TABLE (deleted_user_id UUID, deleted_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH doomed AS (
    SELECT u.id, u.email
    FROM users u
    WHERE u.account_status = 'pending_purge'
      AND u.updated_at < NOW() - INTERVAL '30 days'
      AND COALESCE(u.is_super_admin, FALSE) = FALSE
  ),
  deleted AS (
    DELETE FROM users u
    USING doomed d
    WHERE u.id = d.id
    RETURNING u.id, u.email
  )
  SELECT deleted.id, deleted.email
  FROM deleted;
END;
$$;

COMMENT ON FUNCTION public.purge_pending_purge_users() IS
  'Hard-deletes pending_purge users after 30 days. Child rows cascade via FK ON DELETE CASCADE.';

-- Optional: enable pg_cron on Supabase and schedule daily at 03:30 UTC (09:00 IST):
-- SELECT cron.schedule(
--   'recoverpe-dpdp-purge',
--   '30 3 * * *',
--   $$SELECT * FROM public.purge_pending_purge_users();$$
-- );
--
-- Recoverpe production also invokes this function from the Vercel daily-runner cron.
