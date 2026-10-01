-- Sprint 98: Smart Stocks transactional posting.
-- Run in the Supabase SQL editor after 062 and 063.
--
-- Every stock write goes through one of these functions so a voucher, its
-- lines, the quantity ledger and the cached qty_on_hand either all commit or
-- all roll back. The API calls them with the service role after it has
-- verified the business belongs to the caller's workspace.
--
-- Errors are raised as 'SMART_STOCKS:<CODE>:<detail>' so the API can map them
-- to HTTP statuses without parsing free text.

-- One stock item per name per business, so parchi lines can upsert by name.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_items_business_name
  ON stock_items (business_id, LOWER(BTRIM(name)));

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_direction_created
  ON stock_movements (item_id, direction, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_vouchers_business_supplier
  ON purchase_vouchers (business_id, LOWER(BTRIM(supplier_name)));

-- ---------------------------------------------------------------------------
-- Apply a batch of movements to stock_items under row locks.
-- p_items: [{ "item_id": uuid, "qty": number, "rate": number }]
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.smart_stocks_apply_movements(
  p_business_id UUID,
  p_direction TEXT,
  p_source TEXT,
  p_reference_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_entry JSONB;
  v_item stock_items%ROWTYPE;
  v_qty NUMERIC;
  v_rate NUMERIC;
  v_results JSONB := '[]'::jsonb;
BEGIN
  IF p_direction NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'SMART_STOCKS:INVALID_INPUT:direction must be in or out';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'SMART_STOCKS:INVALID_INPUT:at least one item is required';
  END IF;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_entry ->> 'qty')::NUMERIC;
    v_rate := COALESCE((v_entry ->> 'rate')::NUMERIC, 0);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'SMART_STOCKS:INVALID_INPUT:quantity must be positive';
    END IF;

    IF v_rate < 0 THEN
      RAISE EXCEPTION 'SMART_STOCKS:INVALID_INPUT:rate cannot be negative';
    END IF;

    SELECT * INTO v_item
    FROM stock_items
    WHERE id = (v_entry ->> 'item_id')::UUID
      AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SMART_STOCKS:ITEM_NOT_FOUND:%', v_entry ->> 'item_id';
    END IF;

    IF p_direction = 'out' AND v_item.qty_on_hand < v_qty THEN
      RAISE EXCEPTION 'SMART_STOCKS:INSUFFICIENT_STOCK:% has % % in stock',
        v_item.name, v_item.qty_on_hand, v_item.unit;
    END IF;

    INSERT INTO stock_movements (business_id, item_id, direction, qty, rate, source, reference_id)
    VALUES (p_business_id, v_item.id, p_direction, v_qty, v_rate, p_source, p_reference_id);

    UPDATE stock_items
    SET
      qty_on_hand = CASE
        WHEN p_direction = 'in' THEN qty_on_hand + v_qty
        ELSE qty_on_hand - v_qty
      END,
      last_cost = CASE
        WHEN p_direction = 'in' AND v_rate > 0 THEN v_rate
        ELSE last_cost
      END
    WHERE id = v_item.id;

    v_results := v_results || jsonb_build_object(
      'item_id', v_item.id,
      'name', v_item.name,
      'qty', v_qty,
      'rate', v_rate
    );
  END LOOP;

  RETURN v_results;
END;
$$;

-- ---------------------------------------------------------------------------
-- Post a reviewed parchi: capture -> voucher -> lines -> movements -> stock.
-- p_lines: [{ "stock_item_id": uuid|null, "description": text, "qty": number,
--             "rate": number, "amount": number, "unit": text|null }]
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.smart_stocks_commit_parchi(
  p_business_id UUID,
  p_capture_id UUID,
  p_supplier_name TEXT,
  p_bill_date DATE,
  p_credit_amount NUMERIC,
  p_lines JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_capture_id UUID;
  v_voucher_id UUID;
  v_line JSONB;
  v_item_id UUID;
  v_description TEXT;
  v_unit TEXT;
  v_qty NUMERIC;
  v_rate NUMERIC;
  v_amount NUMERIC;
  v_movements JSONB := '[]'::jsonb;
BEGIN
  IF NULLIF(BTRIM(p_supplier_name), '') IS NULL THEN
    RAISE EXCEPTION 'SMART_STOCKS:INVALID_INPUT:supplier name is required';
  END IF;

  IF p_credit_amount IS NULL OR p_credit_amount < 0 THEN
    RAISE EXCEPTION 'SMART_STOCKS:INVALID_INPUT:credit amount cannot be negative';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'SMART_STOCKS:INVALID_INPUT:at least one line item is required';
  END IF;

  -- Compare-and-set on the capture is the lock: a second concurrent commit of
  -- the same parchi matches zero rows. Any later failure rolls this back.
  UPDATE document_captures
  SET status = 'reviewed'
  WHERE id = p_capture_id
    AND business_id = p_business_id
    AND status = 'pending'
  RETURNING id INTO v_capture_id;

  IF v_capture_id IS NULL THEN
    RAISE EXCEPTION 'SMART_STOCKS:CAPTURE_NOT_PENDING:%', p_capture_id;
  END IF;

  INSERT INTO purchase_vouchers (business_id, supplier_name, bill_date, credit_amount, status)
  VALUES (p_business_id, BTRIM(p_supplier_name), p_bill_date, p_credit_amount, 'posted')
  RETURNING id INTO v_voucher_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_description := BTRIM(COALESCE(v_line ->> 'description', ''));
    v_unit := NULLIF(BTRIM(COALESCE(v_line ->> 'unit', '')), '');
    v_qty := (v_line ->> 'qty')::NUMERIC;
    v_rate := COALESCE((v_line ->> 'rate')::NUMERIC, 0);
    v_amount := COALESCE((v_line ->> 'amount')::NUMERIC, v_qty * v_rate);
    v_item_id := NULLIF(v_line ->> 'stock_item_id', '')::UUID;

    IF v_description = '' THEN
      RAISE EXCEPTION 'SMART_STOCKS:INVALID_INPUT:every line needs a description';
    END IF;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'SMART_STOCKS:INVALID_INPUT:quantity must be positive for %', v_description;
    END IF;

    IF v_rate < 0 OR v_amount < 0 THEN
      RAISE EXCEPTION 'SMART_STOCKS:INVALID_INPUT:rate and amount cannot be negative for %', v_description;
    END IF;

    IF v_item_id IS NOT NULL THEN
      PERFORM 1 FROM stock_items
      WHERE id = v_item_id AND business_id = p_business_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SMART_STOCKS:ITEM_NOT_FOUND:%', v_item_id;
      END IF;
    ELSE
      INSERT INTO stock_items (business_id, name, unit, last_cost)
      VALUES (p_business_id, v_description, COALESCE(v_unit, 'pcs'), v_rate)
      ON CONFLICT (business_id, LOWER(BTRIM(name))) DO NOTHING
      RETURNING id INTO v_item_id;

      IF v_item_id IS NULL THEN
        SELECT id INTO v_item_id
        FROM stock_items
        WHERE business_id = p_business_id
          AND LOWER(BTRIM(name)) = LOWER(v_description);
      END IF;
    END IF;

    INSERT INTO purchase_voucher_lines (
      business_id, voucher_id, stock_item_id, description, qty, rate, amount
    )
    VALUES (p_business_id, v_voucher_id, v_item_id, v_description, v_qty, v_rate, v_amount);

    v_movements := v_movements || jsonb_build_object(
      'item_id', v_item_id,
      'qty', v_qty,
      'rate', v_rate
    );
  END LOOP;

  PERFORM public.smart_stocks_apply_movements(
    p_business_id, 'in', 'parchi', v_voucher_id, v_movements
  );

  RETURN jsonb_build_object(
    'voucher_id', v_voucher_id,
    'capture_id', v_capture_id,
    'items', v_movements
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Execute a parsed voice command exactly once.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.smart_stocks_execute_voice_command(
  p_business_id UUID,
  p_command_id UUID,
  p_direction TEXT,
  p_items JSONB,
  p_execution JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_command_id UUID;
  v_results JSONB;
BEGIN
  UPDATE voice_commands
  SET
    status = 'executed',
    parsed_payload = parsed_payload || jsonb_build_object('execution', COALESCE(p_execution, '{}'::jsonb))
  WHERE id = p_command_id
    AND business_id = p_business_id
    AND status = 'pending'
  RETURNING id INTO v_command_id;

  IF v_command_id IS NULL THEN
    RAISE EXCEPTION 'SMART_STOCKS:COMMAND_NOT_PENDING:%', p_command_id;
  END IF;

  v_results := public.smart_stocks_apply_movements(
    p_business_id, p_direction, 'voice', v_command_id, p_items
  );

  RETURN jsonb_build_object('command_id', v_command_id, 'items', v_results);
END;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard aggregates. Grouped in SQL so a busy shop's movement history is
-- never truncated by the PostgREST row cap, which would misreport dead stock.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.smart_stocks_last_outward(p_business_id UUID)
RETURNS TABLE (item_id UUID, last_outward_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT m.item_id, MAX(m.created_at) AS last_outward_at
  FROM stock_movements m
  WHERE m.business_id = p_business_id
    AND m.direction = 'out'
  GROUP BY m.item_id;
$$;

CREATE OR REPLACE FUNCTION public.smart_stocks_supplier_payables(p_business_id UUID)
RETURNS TABLE (
  supplier_name TEXT,
  voucher_count BIGINT,
  total_credit NUMERIC,
  last_bill_date DATE
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    MIN(v.supplier_name) AS supplier_name,
    COUNT(*) AS voucher_count,
    SUM(v.credit_amount) AS total_credit,
    MAX(v.bill_date) AS last_bill_date
  FROM purchase_vouchers v
  WHERE v.business_id = p_business_id
    AND v.status = 'posted'
  GROUP BY LOWER(BTRIM(v.supplier_name))
  ORDER BY SUM(v.credit_amount) DESC;
$$;

REVOKE ALL ON FUNCTION public.smart_stocks_last_outward(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.smart_stocks_supplier_payables(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_stocks_last_outward(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.smart_stocks_supplier_payables(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.smart_stocks_apply_movements(UUID, TEXT, TEXT, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.smart_stocks_commit_parchi(UUID, UUID, TEXT, DATE, NUMERIC, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.smart_stocks_execute_voice_command(UUID, UUID, TEXT, JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.smart_stocks_apply_movements(UUID, TEXT, TEXT, UUID, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.smart_stocks_commit_parchi(UUID, UUID, TEXT, DATE, NUMERIC, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.smart_stocks_execute_voice_command(UUID, UUID, TEXT, JSONB, JSONB)
  TO service_role;
