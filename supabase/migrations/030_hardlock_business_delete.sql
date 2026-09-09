-- P0 Hardlock: businesses UPDATE/DELETE restricted to true owner (auth_user_id = user_id)
-- Replaces can_manage_workspace policies that allowed admin partners to mutate businesses.

DROP POLICY IF EXISTS businesses_update_workspace ON businesses;
DROP POLICY IF EXISTS businesses_delete_workspace ON businesses;

-- auth_user_id() resolves auth.uid() and Firebase JWT hybrid (see 002_core_schema.sql).
CREATE POLICY "Strict Owner Update"
  ON businesses
  FOR UPDATE
  USING (auth_user_id() = user_id)
  WITH CHECK (auth_user_id() = user_id);

CREATE POLICY "Strict Owner Delete"
  ON businesses
  FOR DELETE
  USING (auth_user_id() = user_id);

COMMENT ON POLICY "Strict Owner Update" ON businesses IS
  'Only the business owner (auth_user_id = user_id) may update business profile rows.';
COMMENT ON POLICY "Strict Owner Delete" ON businesses IS
  'Only the business owner (auth_user_id = user_id) may delete business rows.';
