-- Sprint 20: Micro-transaction fulfillment artifacts & order ledger linkage

ALTER TABLE razorpay_orders
  ADD COLUMN IF NOT EXISTS ledger_id UUID REFERENCES ledgers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_ledger_id
  ON razorpay_orders (ledger_id)
  WHERE ledger_id IS NOT NULL;

ALTER TABLE ledgers
  ADD COLUMN IF NOT EXISTS legal_notice_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS samadhaan_docket_pdf_url TEXT;

COMMENT ON COLUMN razorpay_orders.ledger_id IS
  'Ledger targeted by legal_notice_999 or samadhaan_499 micro-transactions.';

COMMENT ON COLUMN ledgers.legal_notice_pdf_url IS
  'Firebase URL for generated formal demand notice PDF (Part 14).';

COMMENT ON COLUMN ledgers.samadhaan_docket_pdf_url IS
  'Firebase URL for MSME Samadhaan evidence docket PDF (Part 14).';
