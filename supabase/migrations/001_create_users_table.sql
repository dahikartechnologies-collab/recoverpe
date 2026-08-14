-- Table 1: users (The Master Identity)
-- Firebase handles auth; this table stores application state.

CREATE TYPE subscription_plan AS ENUM ('free', 'premium');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  subscription_plan subscription_plan NOT NULL DEFAULT 'free',
  vapi_wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_firebase_uid ON users (firebase_uid);
CREATE INDEX idx_users_phone_number ON users (phone_number);
CREATE INDEX idx_users_email ON users (email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Server-side sync uses the service role key and bypasses RLS.
-- Client reads will be added in a later sprint with Firebase token verification.

COMMENT ON TABLE users IS 'Master identity table synced from Firebase after mobile OTP verification';
