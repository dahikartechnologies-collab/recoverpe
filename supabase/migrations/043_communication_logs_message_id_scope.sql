-- Sprint 56 (Phase 3): scope the provider message id uniqueness per workspace.
-- Run in Supabase SQL Editor after 042.

-- One inbound WhatsApp message from a customer who owes two different merchants
-- produces one audit row per merchant, all sharing Meta's wamid. A globally
-- unique index rejects the second row. Uniqueness belongs per workspace.
DROP INDEX IF EXISTS idx_communication_logs_external_message_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_logs_external_message_user
  ON communication_logs (external_message_id, user_id)
  WHERE external_message_id IS NOT NULL;

COMMENT ON INDEX idx_communication_logs_external_message_user IS
  'Outbound sends have one row per wamid, so delivery-receipt lookups still resolve to a single row. Inbound messages may fan out to several merchants.';
