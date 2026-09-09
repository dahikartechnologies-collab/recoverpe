-- Sprint 36: Khata QR 2.0 — customer amount + auto-approve.

ALTER TABLE pending_onboards
  ADD COLUMN amount NUMERIC(12, 2);

UPDATE pending_onboards
SET amount = 1
WHERE amount IS NULL;

ALTER TABLE pending_onboards
  ALTER COLUMN amount SET NOT NULL;

ALTER TABLE pending_onboards
  ADD CONSTRAINT pending_onboards_amount_positive CHECK (amount > 0);

ALTER TABLE businesses
  ADD COLUMN khata_auto_approve BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN pending_onboards.amount IS
  'Amount entered by the customer on the public Khata QR form.';

COMMENT ON COLUMN businesses.khata_auto_approve IS
  'When true, public Khata QR submissions instantly create contacts and ledgers.';
