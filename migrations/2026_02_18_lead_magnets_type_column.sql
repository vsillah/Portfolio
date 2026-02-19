-- ============================================================================
-- Migration: Lead magnets type column and check constraint
-- Date: 2026-02-18
-- Purpose: Add type column if missing; ensure lead_magnets_type_check allows
--   'pdf', 'ebook', 'document', 'link', 'interactive' (for seed and API).
-- Apply after: 2026_02_18_lead_magnets_funnel_and_category.sql
-- ============================================================================

-- Add type column if it doesn't exist (e.g. from an older schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'type'
  ) THEN
    ALTER TABLE lead_magnets ADD COLUMN type TEXT NOT NULL DEFAULT 'pdf';
  END IF;
END $$;

-- Backfill null or invalid type before tightening constraint
UPDATE lead_magnets SET type = 'pdf' WHERE type IS NULL;
UPDATE lead_magnets SET type = 'pdf' WHERE type IS NOT NULL AND type NOT IN ('pdf', 'ebook', 'document', 'link', 'interactive');

-- Replace the check constraint so seed and API can use these values
ALTER TABLE lead_magnets DROP CONSTRAINT IF EXISTS lead_magnets_type_check;
ALTER TABLE lead_magnets ADD CONSTRAINT lead_magnets_type_check
  CHECK (type IN ('pdf', 'ebook', 'document', 'link', 'interactive'));

-- Default for new rows
ALTER TABLE lead_magnets ALTER COLUMN type SET DEFAULT 'pdf';
