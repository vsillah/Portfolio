-- ============================================================================
-- Migration: Publications ElevenLabs embed + audiobook lead magnet
-- Date: 2026-02-26
-- Purpose: Add per-publication ElevenLabs Audio Native embed config and
--   optional audiobook lead magnet for download (bundle with e-book).
-- ============================================================================

-- ElevenLabs Audio Native embed (per publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publications' AND column_name = 'elevenlabs_project_id'
  ) THEN
    ALTER TABLE publications ADD COLUMN elevenlabs_project_id TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publications' AND column_name = 'elevenlabs_public_user_id'
  ) THEN
    ALTER TABLE publications ADD COLUMN elevenlabs_public_user_id TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publications' AND column_name = 'elevenlabs_player_url'
  ) THEN
    ALTER TABLE publications ADD COLUMN elevenlabs_player_url TEXT;
  END IF;
END $$;

-- Audiobook lead magnet (same publication can have ebook + audiobook = bundle)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publications' AND column_name = 'audiobook_lead_magnet_id'
  ) THEN
    ALTER TABLE publications ADD COLUMN audiobook_lead_magnet_id UUID REFERENCES lead_magnets(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_publications_audiobook_lead_magnet
  ON publications(audiobook_lead_magnet_id) WHERE audiobook_lead_magnet_id IS NOT NULL;
