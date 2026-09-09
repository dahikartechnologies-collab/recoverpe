-- Sprint 49: Zero-cost omnichannel messaging (WhatsApp + BYO SMTP email).

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN contacts.email IS
  'Optional vendor email for email reminder and legal notice fallback.';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"whatsapp_enabled": true, "email_enabled": false, "auto_fallback": true}'::jsonb;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS smtp_settings JSONB NOT NULL DEFAULT '{"host": "", "port": 587, "secure": false, "user": "", "pass": "", "from_name": "", "from_email": ""}'::jsonb;

COMMENT ON COLUMN businesses.notification_preferences IS
  'Channel toggles for outbound reminders: whatsapp_enabled, email_enabled, auto_fallback.';

COMMENT ON COLUMN businesses.smtp_settings IS
  'Per-business BYO SMTP credentials for zero-cost transactional email.';

ALTER TYPE communication_type ADD VALUE IF NOT EXISTS 'email_reminder';
