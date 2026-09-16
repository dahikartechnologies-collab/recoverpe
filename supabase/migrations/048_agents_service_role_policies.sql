-- Allow service-role admin writes to agents (defense in depth if RLS bypass is disabled).

CREATE POLICY agents_service_insert ON agents
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY agents_service_update ON agents
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY agents_service_select ON agents
  FOR SELECT
  TO service_role
  USING (true);
