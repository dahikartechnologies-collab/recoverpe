-- Sprint 88: Dynamic VAPI billing fields and custom wallet recharge metadata.

ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS billed_amount_inr NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS vapi_cost_usd NUMERIC(12, 4);

COMMENT ON COLUMN communication_logs.billed_amount_inr IS
  'Merchant-facing AI voice charge in INR (VAPI USD cost converted + 30% margin).';

COMMENT ON COLUMN communication_logs.vapi_cost_usd IS
  'Raw VAPI provider cost in USD from end-of-call-report.';

ALTER TABLE razorpay_orders
  ADD COLUMN IF NOT EXISTS wallet_base_credit_inr NUMERIC(12, 2);

COMMENT ON COLUMN razorpay_orders.wallet_base_credit_inr IS
  'Wallet credit excluding GST for custom wallet_recharge orders.';
