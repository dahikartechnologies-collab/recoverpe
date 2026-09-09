-- Sprint 55: Tiered Recovery Autopilot & cadence scheduling

CREATE TYPE cadence_run_status AS ENUM ('pending', 'completed', 'halted');

CREATE TABLE cadence_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id UUID NOT NULL REFERENCES ledgers (id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  next_run_at TIMESTAMPTZ NOT NULL,
  status cadence_run_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cadence_runs_ledger_step_unique UNIQUE (ledger_id, step_index)
);

CREATE INDEX idx_cadence_runs_pending_next_run
  ON cadence_runs (next_run_at)
  WHERE status = 'pending';

CREATE INDEX idx_cadence_runs_ledger_id
  ON cadence_runs (ledger_id);

COMMENT ON TABLE cadence_runs IS
  'Idempotent autopilot reminder cadence per ledger. step_index maps to schedule offsets; step_index = schedule length is the monetization flag step.';

ALTER TABLE ledgers
  ADD COLUMN IF NOT EXISTS communication_autopilot BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legal_escalation_ready BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN ledgers.communication_autopilot IS
  'When true, the ledger is enrolled in automated recovery cadence runs.';

COMMENT ON COLUMN ledgers.legal_escalation_ready IS
  'Set after the final autopilot reminder — surfaces legal escalation upsell in the dashboard.';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS autopilot_schedule JSONB NOT NULL DEFAULT '[0, 3, 5, 7]'::jsonb;

COMMENT ON COLUMN businesses.autopilot_schedule IS
  'Premium-customizable day offsets from due_date for autopilot reminders. Free tier always uses [0,3,5,7] server-side.';
