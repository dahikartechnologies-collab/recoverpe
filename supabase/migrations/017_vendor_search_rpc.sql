-- Sprint 29: Vendor aggregation directory & universal workspace search RPCs.

CREATE OR REPLACE FUNCTION public.assert_rpc_user_scope(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_user_id() IS NOT NULL AND auth_user_id() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Forbidden: user scope mismatch.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contact_directory(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_contact_id UUID DEFAULT NULL
)
RETURNS TABLE (
  contact_id UUID,
  contact_name TEXT,
  phone_number TEXT,
  open_invoice_count BIGINT,
  net_outstanding NUMERIC,
  bucket_0_30 NUMERIC,
  bucket_31_60 NUMERIC,
  bucket_61_90 NUMERIC,
  bucket_90_plus NUMERIC,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_user_scope(p_user_id);

  RETURN QUERY
  WITH today AS (
    SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE AS d
  ),
  open_ledgers AS (
    SELECT
      l.contact_id,
      l.balance_due,
      l.due_date
    FROM ledgers l
    WHERE l.user_id = p_user_id
      AND l.balance_due > 0
      AND l.status NOT IN ('paid', 'cancelled', 'refunded')
  ),
  aggregated AS (
    SELECT
      c.id AS contact_id,
      c.name AS contact_name,
      c.phone_number,
      COUNT(ol.contact_id)::BIGINT AS open_invoice_count,
      COALESCE(SUM(ol.balance_due), 0)::NUMERIC AS net_outstanding,
      COALESCE(SUM(ol.balance_due) FILTER (
        WHERE ol.due_date >= (SELECT d FROM today) - INTERVAL '30 days'
      ), 0)::NUMERIC AS bucket_0_30,
      COALESCE(SUM(ol.balance_due) FILTER (
        WHERE ol.due_date < (SELECT d FROM today) - INTERVAL '30 days'
          AND ol.due_date >= (SELECT d FROM today) - INTERVAL '60 days'
      ), 0)::NUMERIC AS bucket_31_60,
      COALESCE(SUM(ol.balance_due) FILTER (
        WHERE ol.due_date < (SELECT d FROM today) - INTERVAL '60 days'
          AND ol.due_date >= (SELECT d FROM today) - INTERVAL '90 days'
      ), 0)::NUMERIC AS bucket_61_90,
      COALESCE(SUM(ol.balance_due) FILTER (
        WHERE ol.due_date < (SELECT d FROM today) - INTERVAL '90 days'
      ), 0)::NUMERIC AS bucket_90_plus
    FROM contacts c
    LEFT JOIN open_ledgers ol ON ol.contact_id = c.id
    WHERE c.user_id = p_user_id
      AND (p_contact_id IS NULL OR c.id = p_contact_id)
    GROUP BY c.id, c.name, c.phone_number
  ),
  counted AS (
    SELECT COUNT(*)::BIGINT AS total_count
    FROM aggregated
  )
  SELECT
    a.contact_id,
    a.contact_name,
    a.phone_number,
    a.open_invoice_count,
    a.net_outstanding,
    a.bucket_0_30,
    a.bucket_31_60,
    a.bucket_61_90,
    a.bucket_90_plus,
    (SELECT total_count FROM counted) AS total_count
  FROM aggregated a
  ORDER BY a.net_outstanding DESC, a.contact_name ASC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 50), 100), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.search_workspace(
  p_user_id UUID,
  p_search_query TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_query TEXT;
  contact_matches JSONB;
  ledger_matches JSONB;
BEGIN
  PERFORM public.assert_rpc_user_scope(p_user_id);

  normalized_query := BTRIM(COALESCE(p_search_query, ''));

  IF normalized_query = '' THEN
    RETURN '[]'::JSONB;
  END IF;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'type', 'Contact',
        'id', c.id,
        'title', c.name,
        'subtitle', c.phone_number,
        'contact_id', c.id
      )
      ORDER BY c.name
    ),
    '[]'::JSONB
  )
  INTO contact_matches
  FROM contacts c
  WHERE c.user_id = p_user_id
    AND c.name ILIKE '%' || normalized_query || '%'
  LIMIT 10;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'type', 'Ledger',
        'id', l.id,
        'title', COALESCE(l.invoice_number, 'Invoice'),
        'subtitle',
          COALESCE(ct.name, 'Unknown')
          || ' · ₹'
          || TRIM(TO_CHAR(l.balance_due, 'FM999,999,990.00'))
          || ' · due '
          || TO_CHAR(l.due_date, 'DD Mon YYYY'),
        'contact_id', l.contact_id,
        'invoice_number', l.invoice_number,
        'balance_due', l.balance_due,
        'due_date', l.due_date
      )
      ORDER BY l.due_date ASC
    ),
    '[]'::JSONB
  )
  INTO ledger_matches
  FROM ledgers l
  LEFT JOIN contacts ct ON ct.id = l.contact_id
  WHERE l.user_id = p_user_id
    AND (
      ct.name ILIKE '%' || normalized_query || '%'
      OR COALESCE(l.invoice_number, '') ILIKE '%' || normalized_query || '%'
      OR TRIM(TO_CHAR(l.balance_due, 'FM999999990.00')) ILIKE '%' || normalized_query || '%'
      OR TO_CHAR(l.due_date, 'YYYY-MM-DD') ILIKE '%' || normalized_query || '%'
      OR TO_CHAR(l.due_date, 'DD Mon YYYY') ILIKE '%' || normalized_query || '%'
    )
  LIMIT 20;

  RETURN contact_matches || ledger_matches;
END;
$$;

COMMENT ON FUNCTION public.get_contact_directory(UUID, INTEGER, INTEGER, UUID) IS
  'Paginated vendor directory with open invoice aggregates and aging buckets.';

COMMENT ON FUNCTION public.search_workspace(UUID, TEXT) IS
  'Universal search across contacts and ledgers; returns categorized JSON matches.';
