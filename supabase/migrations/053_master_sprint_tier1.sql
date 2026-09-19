-- Master Sprint (part 1): app_role enum must commit before downstream DDL uses 'viewer'.
-- Run this migration first, then 054_master_sprint_tier1.sql.

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'viewer';
