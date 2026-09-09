-- Sprint 50: Contact-level Razorpay Smart Collect virtual accounts

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS virtual_account_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS virtual_upi_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS virtual_bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS virtual_ifsc_code TEXT;

COMMENT ON COLUMN contacts.virtual_account_id IS
  'Razorpay virtual account id (va_*) for Smart Collect inbound transfers.';

COMMENT ON COLUMN contacts.virtual_upi_id IS
  'Dedicated UPI VPA assigned by Razorpay Smart Collect for this contact.';

COMMENT ON COLUMN contacts.virtual_bank_account_number IS
  'Virtual bank account number for NEFT/RTGS transfers (populated at provision time).';

COMMENT ON COLUMN contacts.virtual_ifsc_code IS
  'IFSC for the dedicated virtual bank account (populated at provision time).';
