-- Merchants below the GST threshold can skip GSTIN while still issuing bills of supply.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS gst_not_required BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN businesses.gst_not_required IS
  'True when the merchant is not GST-registered (or GST is not applicable). GSTIN may be added later.';
