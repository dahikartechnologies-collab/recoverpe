-- Sprint 79: Ensure Khata auto-approve column exists on production (idempotent).

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS khata_auto_approve BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN businesses.khata_auto_approve IS
  'When true, public Khata QR submissions instantly create contacts and ledgers.';
