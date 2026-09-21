-- Sprint 86: Normalize SaaS tiers to starter/business/premium and add admin-grant expiration.

UPDATE businesses
SET subscription_tier = 'starter'::business_subscription_tier
WHERE subscription_tier = 'free'::business_subscription_tier;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN businesses.subscription_expires_at IS
  'Optional hard expiry for admin-granted or promotional subscriptions. Past dates downgrade entitlements to starter without a cron job.';

COMMENT ON COLUMN businesses.subscription_tier IS
  'Per-business SaaS tier: starter (basic Khata), business (advanced), premium (all features). Legacy free rows map to starter.';
