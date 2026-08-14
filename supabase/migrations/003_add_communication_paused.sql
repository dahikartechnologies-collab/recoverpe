-- Sprint 8: Edge case flag for pausing automated communications per ledger

ALTER TABLE ledgers
ADD COLUMN IF NOT EXISTS communication_paused BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ledgers_communication_paused
ON ledgers (communication_paused)
WHERE communication_paused = TRUE;

COMMENT ON COLUMN ledgers.communication_paused IS
  'When true, automated WhatsApp/VAPI reminders are skipped for this ledger';
