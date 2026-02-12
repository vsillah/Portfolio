-- ============================================================================
-- Migration: Lead magnets schema compatibility for file uploads/downloads
-- Date: 2026-02-11
-- Purpose: Ensure lead_magnets has file_path (and related) columns expected by API.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE lead_magnets ADD COLUMN file_path TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE lead_magnets ADD COLUMN file_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE lead_magnets ADD COLUMN file_size INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'download_count'
  ) THEN
    ALTER TABLE lead_magnets ADD COLUMN download_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE lead_magnets ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- If an older schema used file_url, copy values into file_path.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_magnets' AND column_name = 'file_url'
  ) THEN
    EXECUTE 'UPDATE lead_magnets SET file_path = file_url WHERE file_path IS NULL AND file_url IS NOT NULL';
  END IF;
END $$;

-- Keep defaults consistent for existing rows.
UPDATE lead_magnets SET download_count = 0 WHERE download_count IS NULL;
UPDATE lead_magnets SET is_active = true WHERE is_active IS NULL;
