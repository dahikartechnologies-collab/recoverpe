-- Sprint 55.4: Add wallet_advance enum value (must commit before use in 041).

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'wallet_advance';
