-- Hotfix: Scope vendor directory aggregates to the active business workspace.

DROP FUNCTION IF EXISTS public.get_contact_directory(UUID, INTEGER, INTEGER, UUID);

CREATE OR REPLACE FUNCTION public.get_contact_directory(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_contact_id UUID DEFAULT NULL,
  p_business_id UUID DEFAULT NULL
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
  scoped_contacts AS (
    SELECT DISTINCT c.id AS contact_id
    FROM contacts c
    INNER JOIN ledgers l ON l.contact_id = c.id
    WHERE c.user_id = p_user_id
      AND l.user_id = p_user_id
      AND (
        (p_business_id IS NULL AND l.business_id IS NULL)
        OR l.business_id = p_business_id
      )
      AND (p_contact_id IS NULL OR c.id = p_contact_id)
  ),
  open_ledgers AS (
    SELECT
      l.contact_id,
      l.balance_due,
      l.due_date
    FROM ledgers l
    INNER JOIN scoped_contacts sc ON sc.contact_id = l.contact_id
    WHERE l.user_id = p_user_id
      AND l.balance_due > 0
      AND l.status NOT IN ('paid', 'cancelled', 'refunded')
      AND (
        (p_business_id IS NULL AND l.business_id IS NULL)
        OR l.business_id = p_business_id
      )
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
    INNER JOIN scoped_contacts sc ON sc.contact_id = c.id
    LEFT JOIN open_ledgers ol ON ol.contact_id = c.id
    WHERE c.user_id = p_user_id
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

COMMENT ON FUNCTION public.get_contact_directory(UUID, INTEGER, INTEGER, UUID, UUID) IS
  'Paginated vendor directory scoped to a business workspace (NULL business_id = personal ledgers).';
