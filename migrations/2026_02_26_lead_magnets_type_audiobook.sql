-- ============================================================================
-- Migration: Add 'audiobook' to lead_magnets type
-- Date: 2026-02-26
-- Purpose: Allow lead magnets with type 'audiobook' for publication audiobook
--   downloads (bundle with e-book). Apply after 2026_02_26_publications_elevenlabs_and_audiobook.sql.
-- ============================================================================

ALTER TABLE lead_magnets DROP CONSTRAINT IF EXISTS lead_magnets_type_check;
ALTER TABLE lead_magnets ADD CONSTRAINT lead_magnets_type_check
  CHECK (type IN ('pdf', 'ebook', 'document', 'link', 'interactive', 'audiobook'));
