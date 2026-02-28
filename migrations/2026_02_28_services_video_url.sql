-- ============================================================================
-- Migration: Add video_url and video_thumbnail_url to services
-- Date: 2026-02-28
-- Purpose: Allow services to have an optional video (and thumbnail) for display
--          on service cards, in bundles, and as lead magnets.
-- Apply after: 2026_02_11_services_table.sql
-- ============================================================================

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT;
