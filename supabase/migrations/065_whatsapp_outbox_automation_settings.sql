-- Sprint 100: WhatsApp outbox transparency and per-business automation toggles.
--
-- communication_logs is already the WhatsApp log (tenancy, wamid, delivery
-- status, autopilot dedup). Extend it with the exact text that went out rather
-- than creating a parallel table that the webhook and dedup gate would miss.

ALTER TYPE communication_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'sent';

ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
  ADD COLUMN IF NOT EXISTS message_body TEXT,
  ADD COLUMN IF NOT EXISTS message_type TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

ALTER TABLE communication_logs
  DROP CONSTRAINT IF EXISTS communication_logs_message_type_check;

ALTER TABLE communication_logs
  ADD CONSTRAINT communication_logs_message_type_check
  CHECK (
    message_type IS NULL
    OR message_type IN ('reminder', 'receipt', 'legal_notice', 'reply', 'parchi', 'marketing')
  );

ALTER TABLE communication_logs
  DROP CONSTRAINT IF EXISTS communication_logs_message_body_length_check;

ALTER TABLE communication_logs
  ADD CONSTRAINT communication_logs_message_body_length_check
  CHECK (message_body IS NULL OR char_length(message_body) <= 4096);

COMMENT ON COLUMN communication_logs.summary IS
  'Short human-readable description for the audit timeline. The exact outbound text lives in message_body.';

COMMENT ON COLUMN communication_logs.message_body IS
  'Exact text sent to the recipient (template messages store the rendered copy). Merchant-visible audit trail.';

COMMENT ON COLUMN communication_logs.recipient_phone IS
  'E.164 digits the message was addressed to, as sent to Meta.';

COMMENT ON COLUMN communication_logs.message_type IS
  'reminder | receipt | legal_notice | reply | parchi | marketing.';

CREATE INDEX IF NOT EXISTS idx_communication_logs_ledger_executed
  ON communication_logs (ledger_id, executed_at DESC)
  WHERE ledger_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communication_logs_external_message
  ON communication_logs (external_message_id)
  WHERE external_message_id IS NOT NULL;

-- Read-only projection under the name the product spec uses. security_invoker
-- keeps the communication_logs RLS policies in force for every caller.
CREATE OR REPLACE VIEW whatsapp_messages
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  business_id,
  contact_id,
  ledger_id,
  recipient_phone,
  message_body,
  message_type,
  status,
  external_message_id AS meta_message_id,
  direction,
  failure_reason,
  delivered_at,
  read_at,
  executed_at AS created_at
FROM communication_logs
WHERE channel = 'whatsapp';

COMMENT ON VIEW whatsapp_messages IS
  'WhatsApp outbox/inbox projection of communication_logs for merchant transparency.';

-- ---------------------------------------------------------------------------
-- Automation & AI toggles
-- ---------------------------------------------------------------------------

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS automation_settings JSONB NOT NULL
    DEFAULT '{"recovery_autopilot": true, "smart_stocks_receipts": true, "b2b_network": false}'::jsonb;

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_automation_settings_object_check;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_automation_settings_object_check
  CHECK (jsonb_typeof(automation_settings) = 'object');

COMMENT ON COLUMN businesses.automation_settings IS
  'Merchant kill switches: recovery_autopilot (debtor reminders), smart_stocks_receipts (voice checkout WhatsApp), b2b_network (anonymous dead-stock sharing; opt-in).';
