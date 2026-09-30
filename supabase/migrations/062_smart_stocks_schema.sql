-- Sprint 96: Smart Stocks phase 1 — Tally-lite schema and workspace RLS.
-- No application code reads these tables yet. Run in the Supabase SQL editor after 061.

CREATE OR REPLACE FUNCTION public.touch_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- stock_items
-- ---------------------------------------------------------------------------

CREATE TABLE stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  hsn TEXT,
  gst_rate NUMERIC NOT NULL DEFAULT 0,
  reorder_level NUMERIC NOT NULL DEFAULT 0,
  qty_on_hand NUMERIC NOT NULL DEFAULT 0,
  last_cost NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_items_name_present CHECK (NULLIF(BTRIM(name), '') IS NOT NULL),
  CONSTRAINT stock_items_unit_present CHECK (NULLIF(BTRIM(unit), '') IS NOT NULL)
);

CREATE INDEX idx_stock_items_business_id ON stock_items (business_id);

CREATE TRIGGER trg_stock_items_touch_updated_at
  BEFORE UPDATE ON stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_row_updated_at();

COMMENT ON TABLE stock_items IS
  'Sellable or purchasable item for a business. Quantity on hand is the cached balance of stock_movements.';

-- ---------------------------------------------------------------------------
-- purchase_vouchers
-- ---------------------------------------------------------------------------

CREATE TABLE purchase_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  bill_date DATE NOT NULL,
  credit_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_vouchers_supplier_present CHECK (
    NULLIF(BTRIM(supplier_name), '') IS NOT NULL
  )
);

CREATE INDEX idx_purchase_vouchers_business_id ON purchase_vouchers (business_id);

CREATE TRIGGER trg_purchase_vouchers_touch_updated_at
  BEFORE UPDATE ON purchase_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_row_updated_at();

COMMENT ON TABLE purchase_vouchers IS
  'Supplier bill that is not yet a paid expense. Posted vouchers are the payable.';

-- ---------------------------------------------------------------------------
-- purchase_voucher_lines
-- business_id is denormalized from the parent voucher so RLS and indexes match
-- the other Smart Stocks tables.
-- ---------------------------------------------------------------------------

CREATE TABLE purchase_voucher_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  voucher_id UUID NOT NULL REFERENCES purchase_vouchers (id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_voucher_lines_description_present CHECK (
    NULLIF(BTRIM(description), '') IS NOT NULL
  )
);

CREATE INDEX idx_purchase_voucher_lines_business_id
  ON purchase_voucher_lines (business_id);

CREATE INDEX idx_purchase_voucher_lines_voucher_id
  ON purchase_voucher_lines (voucher_id);

CREATE TRIGGER trg_purchase_voucher_lines_touch_updated_at
  BEFORE UPDATE ON purchase_voucher_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_row_updated_at();

-- ---------------------------------------------------------------------------
-- stock_movements
-- ---------------------------------------------------------------------------

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  qty NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('parchi', 'voice', 'manual', 'sale')),
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_business_id ON stock_movements (business_id);

CREATE INDEX idx_stock_movements_item_id ON stock_movements (item_id);

CREATE TRIGGER trg_stock_movements_touch_updated_at
  BEFORE UPDATE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_row_updated_at();

COMMENT ON TABLE stock_movements IS
  'Quantity ledger. On-hand stock is the sum of in rows minus out rows.';

-- ---------------------------------------------------------------------------
-- document_captures
-- ---------------------------------------------------------------------------

CREATE TABLE document_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  raw_ai_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_captures_photo_url_present CHECK (
    NULLIF(BTRIM(photo_url), '') IS NOT NULL
  )
);

CREATE INDEX idx_document_captures_business_id ON document_captures (business_id);

CREATE TRIGGER trg_document_captures_touch_updated_at
  BEFORE UPDATE ON document_captures
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_row_updated_at();

COMMENT ON TABLE document_captures IS
  'Parchi Reader inbox. A reviewed capture is posted into a purchase voucher.';

-- ---------------------------------------------------------------------------
-- voice_commands
-- ---------------------------------------------------------------------------

CREATE TABLE voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  intent TEXT NOT NULL,
  parsed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'executed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT voice_commands_transcript_present CHECK (
    NULLIF(BTRIM(transcript), '') IS NOT NULL
  )
);

CREATE INDEX idx_voice_commands_business_id ON voice_commands (business_id);

CREATE TRIGGER trg_voice_commands_touch_updated_at
  BEFORE UPDATE ON voice_commands
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_row_updated_at();

COMMENT ON TABLE voice_commands IS
  'Conversational checkout inbox. Executed commands post stock movements and khata rows.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Same workspace gate as businesses/ledgers: can_manage_workspace(owner user id),
-- reached through the row's business_id.
-- ---------------------------------------------------------------------------

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_voucher_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_items_select_workspace ON stock_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = stock_items.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY stock_items_insert_workspace ON stock_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = stock_items.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY stock_items_update_workspace ON stock_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = stock_items.business_id
        AND can_manage_workspace(b.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = stock_items.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY stock_items_delete_workspace ON stock_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = stock_items.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY purchase_vouchers_select_workspace ON purchase_vouchers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = purchase_vouchers.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY purchase_vouchers_insert_workspace ON purchase_vouchers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = purchase_vouchers.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY purchase_vouchers_update_workspace ON purchase_vouchers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = purchase_vouchers.business_id
        AND can_manage_workspace(b.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = purchase_vouchers.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY purchase_vouchers_delete_workspace ON purchase_vouchers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = purchase_vouchers.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY purchase_voucher_lines_select_workspace ON purchase_voucher_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = purchase_voucher_lines.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY purchase_voucher_lines_insert_workspace ON purchase_voucher_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = purchase_voucher_lines.business_id
        AND can_manage_workspace(b.user_id)
    )
    AND EXISTS (
      SELECT 1
      FROM purchase_vouchers v
      WHERE v.id = purchase_voucher_lines.voucher_id
        AND v.business_id = purchase_voucher_lines.business_id
    )
    AND EXISTS (
      SELECT 1
      FROM stock_items s
      WHERE s.id = purchase_voucher_lines.stock_item_id
        AND s.business_id = purchase_voucher_lines.business_id
    )
  );

CREATE POLICY purchase_voucher_lines_update_workspace ON purchase_voucher_lines
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = purchase_voucher_lines.business_id
        AND can_manage_workspace(b.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = purchase_voucher_lines.business_id
        AND can_manage_workspace(b.user_id)
    )
    AND EXISTS (
      SELECT 1
      FROM purchase_vouchers v
      WHERE v.id = purchase_voucher_lines.voucher_id
        AND v.business_id = purchase_voucher_lines.business_id
    )
    AND EXISTS (
      SELECT 1
      FROM stock_items s
      WHERE s.id = purchase_voucher_lines.stock_item_id
        AND s.business_id = purchase_voucher_lines.business_id
    )
  );

CREATE POLICY purchase_voucher_lines_delete_workspace ON purchase_voucher_lines
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = purchase_voucher_lines.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY stock_movements_select_workspace ON stock_movements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = stock_movements.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY stock_movements_insert_workspace ON stock_movements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = stock_movements.business_id
        AND can_manage_workspace(b.user_id)
    )
    AND EXISTS (
      SELECT 1
      FROM stock_items s
      WHERE s.id = stock_movements.item_id
        AND s.business_id = stock_movements.business_id
    )
  );

CREATE POLICY stock_movements_update_workspace ON stock_movements
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = stock_movements.business_id
        AND can_manage_workspace(b.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = stock_movements.business_id
        AND can_manage_workspace(b.user_id)
    )
    AND EXISTS (
      SELECT 1
      FROM stock_items s
      WHERE s.id = stock_movements.item_id
        AND s.business_id = stock_movements.business_id
    )
  );

CREATE POLICY stock_movements_delete_workspace ON stock_movements
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = stock_movements.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY document_captures_select_workspace ON document_captures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = document_captures.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY document_captures_insert_workspace ON document_captures
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = document_captures.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY document_captures_update_workspace ON document_captures
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = document_captures.business_id
        AND can_manage_workspace(b.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = document_captures.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY document_captures_delete_workspace ON document_captures
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = document_captures.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY voice_commands_select_workspace ON voice_commands
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = voice_commands.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY voice_commands_insert_workspace ON voice_commands
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = voice_commands.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY voice_commands_update_workspace ON voice_commands
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = voice_commands.business_id
        AND can_manage_workspace(b.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = voice_commands.business_id
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY voice_commands_delete_workspace ON voice_commands
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = voice_commands.business_id
        AND can_manage_workspace(b.user_id)
    )
  );
