-- Sprint 10: Razorpay order tracking for webhook idempotency

CREATE TABLE IF NOT EXISTS razorpay_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  purchase_type TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_user_id ON razorpay_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_status ON razorpay_orders (status);

COMMENT ON TABLE razorpay_orders IS
  'Tracks Razorpay checkout orders and prevents duplicate webhook fulfillment';
