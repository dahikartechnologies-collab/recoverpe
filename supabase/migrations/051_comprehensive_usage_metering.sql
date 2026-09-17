-- Sprint 61: Comprehensive usage metering and unit-economics tracking.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS quota_smart_collect INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_smart_collect INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_sms INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_sms INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_whatsapp INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_whatsapp INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_vapi_minutes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_vapi_minutes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_invoices INT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS usage_invoices INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pass_through_overages BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_volume_collected_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gateway_fees_inr NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN businesses.quota_smart_collect IS
  'Smart Collect Route settlements included in the current billing period.';
COMMENT ON COLUMN businesses.usage_smart_collect IS
  'Smart Collect settlements consumed in the current billing period.';
COMMENT ON COLUMN businesses.quota_sms IS
  'DLT SMS messages included in the current billing period.';
COMMENT ON COLUMN businesses.usage_sms IS
  'DLT SMS messages sent in the current billing period.';
COMMENT ON COLUMN businesses.quota_whatsapp IS
  'WhatsApp alert messages included in the current billing period.';
COMMENT ON COLUMN businesses.usage_whatsapp IS
  'WhatsApp alert messages sent in the current billing period.';
COMMENT ON COLUMN businesses.quota_vapi_minutes IS
  'AI voice call minutes included in the current billing period.';
COMMENT ON COLUMN businesses.usage_vapi_minutes IS
  'AI voice call minutes consumed in the current billing period.';
COMMENT ON COLUMN businesses.quota_invoices IS
  'Tax invoices included in the current billing period (15 on Free).';
COMMENT ON COLUMN businesses.usage_invoices IS
  'Tax invoices generated in the current billing period.';
COMMENT ON COLUMN businesses.pass_through_overages IS
  'When true, over-quota usage is billed at pass-through rates on the next invoice.';
COMMENT ON COLUMN businesses.total_volume_collected_inr IS
  'Lifetime Smart Collect volume settled through RecoverPe Route (INR).';
COMMENT ON COLUMN businesses.total_gateway_fees_inr IS
  'Lifetime payment gateway fees paid on collected volume (INR).';
