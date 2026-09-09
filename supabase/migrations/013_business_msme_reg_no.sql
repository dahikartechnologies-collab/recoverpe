ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS msme_reg_no TEXT;

COMMENT ON COLUMN businesses.msme_reg_no IS
  'Udyam / MSME registration number printed on tax invoices.';
