-- Sprint 90: Global platform economics singleton and VAPI billing audit columns.

CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  vapi_margin_percentage NUMERIC(6, 2) NOT NULL DEFAULT 30.0,
  fx_risk_buffer_percentage NUMERIC(6, 2) NOT NULL DEFAULT 2.0,
  fallback_usd_to_inr NUMERIC(10, 4) NOT NULL DEFAULT 86.0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_settings IS
  'Singleton row controlling AI voice FX buffer, margin, and fallback USD/INR rate.';

INSERT INTO platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS applied_fx_rate NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS applied_margin_pct NUMERIC(6, 2);

COMMENT ON COLUMN communication_logs.applied_fx_rate IS
  'Effective USD/INR rate after FX risk buffer applied at billing time.';

COMMENT ON COLUMN communication_logs.applied_margin_pct IS
  'Platform margin percentage applied to base INR cost at billing time.';

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_authenticated_select ON platform_settings;

CREATE POLICY platform_settings_authenticated_select ON platform_settings
  FOR SELECT
  USING (auth_user_id() IS NOT NULL);

DROP POLICY IF EXISTS platform_settings_super_admin_update ON platform_settings;

CREATE POLICY platform_settings_super_admin_update ON platform_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth_user_id() AND u.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth_user_id() AND u.is_super_admin = true
    )
  );
