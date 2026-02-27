-- ============================================================================
-- Migration: Publications self-hosted audio preview
-- Date: 2026-02-26
-- Purpose: Allow a playable audio preview from our own storage or a pasted URL
--   instead of (or in addition to) ElevenLabs Audio Native embed.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publications' AND column_name = 'audio_preview_url'
  ) THEN
    ALTER TABLE publications ADD COLUMN audio_preview_url TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publications' AND column_name = 'audio_file_path'
  ) THEN
    ALTER TABLE publications ADD COLUMN audio_file_path TEXT;
  END IF;
END $$;
