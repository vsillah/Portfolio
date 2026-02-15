-- Add upsell_addons JSONB column to proposals table
-- Stores optional upsell recommendations auto-attached from offer_upsell_paths
-- when a proposal is created. Each entry has: title, description, price,
-- perceived_value, is_optional, risk_reversal, credit_note.
--
-- This column was applied directly to the database on 2026-02-15.
-- This migration file exists for version-control traceability.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS upsell_addons JSONB DEFAULT '[]';

COMMENT ON COLUMN proposals.upsell_addons IS 'Optional upsell add-on recommendations from offer_upsell_paths, auto-attached at proposal creation';
