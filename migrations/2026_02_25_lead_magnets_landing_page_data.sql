-- ============================================================================
-- Migration: Add landing_page_data JSONB column to lead_magnets
-- Date: 2026-02-25
-- Purpose: Store rich landing page content (hero, benefits, author bio, etc.)
--   per lead magnet so dedicated landing pages can be data-driven.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_magnets'
      AND column_name = 'landing_page_data'
  ) THEN
    ALTER TABLE lead_magnets ADD COLUMN landing_page_data JSONB;
  END IF;
END $$;

COMMENT ON COLUMN lead_magnets.landing_page_data IS
  'Rich landing page content: { headline, subheadline, benefits[], author, coverImage, ctaText }';
