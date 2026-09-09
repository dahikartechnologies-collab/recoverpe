-- Hotfix: Resolve total_count ambiguity in get_contact_directory (PL/pgSQL output column shadowing).

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
#variable_conflict use_column
BEGIN
  PERFORM public.assert_rpc_user_scope(p_user_id);

  RETURN QUERY
  WITH today AS (
    SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE AS today_date
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
  contact_aggregates AS (
    SELECT
      c.id AS contact_id,
      c.name AS contact_name,
      c.phone_number,
      COUNT(ol.contact_id)::BIGINT AS open_invoice_count,
      COALESCE(SUM(ol.balance_due), 0)::NUMERIC AS net_outstanding,
      COALESCE(SUM(ol.balance_due) FILTER (
        WHERE ol.due_date >= (SELECT t.today_date FROM today t) - INTERVAL '30 days'
      ), 0)::NUMERIC AS bucket_0_30,
      COALESCE(SUM(ol.balance_due) FILTER (
        WHERE ol.due_date < (SELECT t.today_date FROM today t) - INTERVAL '30 days'
          AND ol.due_date >= (SELECT t.today_date FROM today t) - INTERVAL '60 days'
      ), 0)::NUMERIC AS bucket_31_60,
      COALESCE(SUM(ol.balance_due) FILTER (
        WHERE ol.due_date < (SELECT t.today_date FROM today t) - INTERVAL '60 days'
          AND ol.due_date >= (SELECT t.today_date FROM today t) - INTERVAL '90 days'
      ), 0)::NUMERIC AS bucket_61_90,
      COALESCE(SUM(ol.balance_due) FILTER (
        WHERE ol.due_date < (SELECT t.today_date FROM today t) - INTERVAL '90 days'
      ), 0)::NUMERIC AS bucket_90_plus
    FROM contacts c
    LEFT JOIN open_ledgers ol ON ol.contact_id = c.id
    WHERE c.user_id = p_user_id
      AND (p_contact_id IS NULL OR c.id = p_contact_id)
    GROUP BY c.id, c.name, c.phone_number
  ),
  ranked_contacts AS (
    SELECT
      ca.contact_id,
      ca.contact_name,
      ca.phone_number,
      ca.open_invoice_count,
      ca.net_outstanding,
      ca.bucket_0_30,
      ca.bucket_31_60,
      ca.bucket_61_90,
      ca.bucket_90_plus,
      COUNT(*) OVER ()::BIGINT AS directory_total_count
    FROM contact_aggregates ca
  )
  SELECT
    rc.contact_id,
    rc.contact_name,
    rc.phone_number,
    rc.open_invoice_count,
    rc.net_outstanding,
    rc.bucket_0_30,
    rc.bucket_31_60,
    rc.bucket_61_90,
    rc.bucket_90_plus,
    rc.directory_total_count AS total_count
  FROM ranked_contacts rc
  ORDER BY rc.net_outstanding DESC, rc.contact_name ASC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 50), 100), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

COMMENT ON FUNCTION public.get_contact_directory(UUID, INTEGER, INTEGER, UUID) IS
  'Paginated vendor directory with open invoice aggregates, aging buckets, and windowed total_count.';
