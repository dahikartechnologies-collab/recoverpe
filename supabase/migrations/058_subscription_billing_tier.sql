-- Sprint 87: Preserve paid Razorpay tier when admin-granted passes expire.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_billing_tier business_subscription_tier;

UPDATE businesses
SET subscription_billing_tier = subscription_tier
WHERE subscription_billing_tier IS NULL
  AND subscription_tier IN ('business', 'premium')
  AND razorpay_subscription_id IS NOT NULL
  AND razorpay_subscription_id <> 'admin_granted';

COMMENT ON COLUMN businesses.subscription_billing_tier IS
  'Last paid SaaS tier from Razorpay. Used to restore entitlements after an admin-granted pass expires.';
