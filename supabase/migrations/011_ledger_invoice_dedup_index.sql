-- Sprint 19: CSV import idempotency by business invoice number
-- Run in Supabase SQL Editor after migrations 001–010.

CREATE UNIQUE INDEX IF NOT EXISTS idx_ledgers_business_invoice_number_unique
  ON ledgers (business_id, invoice_number)
  WHERE business_id IS NOT NULL
    AND invoice_number IS NOT NULL
    AND btrim(invoice_number) <> '';

COMMENT ON INDEX idx_ledgers_business_invoice_number_unique IS
  'Prevents duplicate Tally/business imports for the same invoice_number within a business.';
