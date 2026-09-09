-- Sprint 52: Consolidate Smart Collect storage onto contacts.virtual_*.
--
-- Two virtual-account storage models grew in parallel:
--   1. virtual_accounts table (018) — business-scoped, written by
--      POST /api/vendors/[id]/virtual-account, keyed on provider_reference_id.
--   2. contacts.virtual_* columns (033) — contact-scoped, written by the
--      Sprint 50 auto-provisioning hook, keyed on virtual_account_id.
--
-- Two webhook handlers resolved the payer from different tables with different
-- accounting models, so the same virtual_account.credited event could be booked
-- two different ways. The wallet-first model on contacts.virtual_* is now
-- canonical because it handles overpayment and standing advances, which
-- straight FIFO allocation cannot.
--
-- This migration backfills the canonical columns from legacy rows so no
-- existing virtual account stops resolving. virtual_accounts is retained
-- read-only for lookup fallback and historical reference; it is NOT dropped.
--
-- Safe to re-run: the backfill only touches contacts whose virtual_account_id
-- is still NULL, and every write is guarded against unique-constraint
-- collisions.

-- ---------------------------------------------------------------------------
-- 1. Index the legacy lookup key
-- ---------------------------------------------------------------------------
-- The fallback resolver looks up virtual_accounts by provider_reference_id on
-- every unmatched inbound webhook. That column had no index.

CREATE INDEX IF NOT EXISTS idx_virtual_accounts_provider_reference_id
  ON virtual_accounts (provider, provider_reference_id)
  WHERE provider_reference_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Backfill contacts.virtual_* from legacy virtual_accounts
-- ---------------------------------------------------------------------------
-- A contact can legitimately have more than one legacy row (the table is
-- unique per business+contact, not per contact). Pick the most recently
-- created active Razorpay row as the canonical one.

WITH canonical_legacy AS (
  SELECT DISTINCT ON (va.contact_id)
    va.contact_id,
    va.provider_reference_id,
    va.virtual_upi_id,
    va.virtual_account_number,
    va.ifsc_code
  FROM virtual_accounts AS va
  WHERE va.provider = 'razorpay'
    AND va.status = 'active'
    AND NULLIF(BTRIM(va.provider_reference_id), '') IS NOT NULL
  ORDER BY va.contact_id, va.created_at DESC
)
UPDATE contacts AS c
SET
  virtual_account_id = cl.provider_reference_id,
  virtual_upi_id = CASE
    WHEN cl.virtual_upi_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM contacts AS dupe
        WHERE dupe.virtual_upi_id = cl.virtual_upi_id
      )
    THEN cl.virtual_upi_id
    ELSE c.virtual_upi_id
  END,
  virtual_bank_account_number = COALESCE(
    c.virtual_bank_account_number,
    cl.virtual_account_number
  ),
  virtual_ifsc_code = COALESCE(c.virtual_ifsc_code, cl.ifsc_code)
FROM canonical_legacy AS cl
WHERE c.id = cl.contact_id
  AND c.virtual_account_id IS NULL
  -- Never violate the UNIQUE constraint on contacts.virtual_account_id.
  AND NOT EXISTS (
    SELECT 1 FROM contacts AS taken
    WHERE taken.virtual_account_id = cl.provider_reference_id
  );

-- ---------------------------------------------------------------------------
-- 3. Report anything the backfill could not migrate
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_unmigrated INTEGER;
  v_migrated INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_migrated
  FROM contacts
  WHERE virtual_account_id IS NOT NULL;

  SELECT COUNT(DISTINCT va.contact_id)
  INTO v_unmigrated
  FROM virtual_accounts AS va
  JOIN contacts AS c ON c.id = va.contact_id
  WHERE va.provider = 'razorpay'
    AND va.status = 'active'
    AND NULLIF(BTRIM(va.provider_reference_id), '') IS NOT NULL
    AND c.virtual_account_id IS DISTINCT FROM va.provider_reference_id;

  RAISE NOTICE 'Smart Collect consolidation: % contacts now carry a canonical virtual_account_id.', v_migrated;

  IF v_unmigrated > 0 THEN
    RAISE NOTICE 'Smart Collect consolidation: % contact(s) still resolve only via the legacy virtual_accounts fallback (multiple business-scoped VAs, or an id already claimed by another contact). These continue to work through the resolver fallback.', v_unmigrated;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Mark the legacy table
-- ---------------------------------------------------------------------------
-- Not dropped and not constrained: POST /api/vendors/[id]/virtual-account still
-- writes here until Sprint 52 Part 2 repoints it. The webhook resolver reads
-- this table only when contacts.virtual_account_id yields no match.

COMMENT ON TABLE virtual_accounts IS
  'LEGACY (Sprint 52): business-scoped Smart Collect virtual accounts. Canonical storage is contacts.virtual_*. Retained for resolver fallback and history. Do not add new read paths against this table.';

COMMENT ON COLUMN contacts.virtual_account_id IS
  'CANONICAL Razorpay virtual account id (va_*) for Smart Collect inbound transfers. Backfilled from virtual_accounts.provider_reference_id in migration 036.';
