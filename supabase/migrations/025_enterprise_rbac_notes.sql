-- Sprint 40 (part 1): Expand app_role enum
-- PostgreSQL requires new enum values to be committed before they can be referenced.
-- Run this migration first, then 026_enterprise_rbac_notes.sql.

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'recovery_agent';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'accountant';
