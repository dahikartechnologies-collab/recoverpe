-- Sprint 18: Profile & settings expansion on users table
-- Run in Supabase SQL Editor after migrations 001–009.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS billing_address TEXT,
  ADD COLUMN IF NOT EXISTS alternate_phone TEXT;

COMMENT ON COLUMN users.full_name IS
  'Display name for invoices, settings, and account profile.';

COMMENT ON COLUMN users.billing_address IS
  'Optional billing address for account records and future invoicing.';

COMMENT ON COLUMN users.alternate_phone IS
  'Optional secondary contact number (E.164 or +91 format stored by app).';
