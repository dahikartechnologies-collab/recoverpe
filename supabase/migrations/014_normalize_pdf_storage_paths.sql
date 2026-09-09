-- Sprint 25: Replace persisted signed URLs with raw GCS/Firebase storage paths.

UPDATE ledgers
SET pdf_url = 'secure/invoices/' || id::text || '.pdf'
WHERE pdf_url IS NOT NULL
  AND pdf_url LIKE 'http%';

UPDATE ledgers
SET legal_notice_pdf_url = 'secure/legal_notices/' || id::text || '.pdf'
WHERE legal_notice_pdf_url IS NOT NULL
  AND legal_notice_pdf_url LIKE 'http%';

UPDATE ledgers
SET samadhaan_docket_pdf_url = 'secure/samadhaan_dockets/' || id::text || '.pdf'
WHERE samadhaan_docket_pdf_url IS NOT NULL
  AND samadhaan_docket_pdf_url LIKE 'http%';

COMMENT ON COLUMN ledgers.pdf_url IS
  'Firebase/GCS object path for invoice PDF (e.g. secure/invoices/{ledger_id}.pdf).';

COMMENT ON COLUMN ledgers.legal_notice_pdf_url IS
  'Firebase/GCS object path for legal notice PDF.';

COMMENT ON COLUMN ledgers.samadhaan_docket_pdf_url IS
  'Firebase/GCS object path for Samadhaan evidence docket PDF.';
