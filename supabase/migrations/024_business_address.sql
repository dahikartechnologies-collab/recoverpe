-- Sprint 40: Business profile address for legal dockets and invoices
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS business_address TEXT;

COMMENT ON COLUMN businesses.business_address IS
  'Registered business address printed on legal dockets and official documents.';
