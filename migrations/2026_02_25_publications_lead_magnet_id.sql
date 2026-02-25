-- ============================================================================
-- Migration: Add lead_magnet_id FK to publications
-- Date: 2026-02-25
-- Purpose: Link a publication to a lead magnet so the Publications homepage
--   section can show a lead-magnet download CTA instead of a store/Amazon link.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'publications'
      AND column_name = 'lead_magnet_id'
  ) THEN
    ALTER TABLE publications ADD COLUMN lead_magnet_id UUID REFERENCES lead_magnets(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_publications_lead_magnet
  ON publications(lead_magnet_id) WHERE lead_magnet_id IS NOT NULL;
