-- Sprint 15: VAPI call insights and webhook linkage on communication_logs

ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS sentiment TEXT,
  ADD COLUMN IF NOT EXISTS executive_summary TEXT,
  ADD COLUMN IF NOT EXISTS vapi_call_id TEXT,
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_communication_logs_vapi_call_id
  ON communication_logs (vapi_call_id);

COMMENT ON COLUMN communication_logs.sentiment IS
  'AI sentiment badge: cooperative, evasive, or hostile';

COMMENT ON COLUMN communication_logs.vapi_call_id IS
  'External VAPI call identifier for webhook reconciliation';
