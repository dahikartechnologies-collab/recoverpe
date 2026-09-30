-- Sprint 95: custom expense category + narration label stored in notes.
-- Run in the Supabase SQL editor after 060.

ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'custom';

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS custom_category_label TEXT;

COMMENT ON COLUMN expenses.custom_category_label IS
  'Merchant-entered name when category is custom. Narration stays in notes.';

COMMENT ON COLUMN expenses.notes IS
  'Tally-style narration for the voucher.';
