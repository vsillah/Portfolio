-- ============================================================================
-- Migration: Add presentation_url to services
-- Date: 2026-03-01
-- Purpose: Allow services to have an optional Gamma (or other) presentation
--          embed URL for display as a lead magnet on the Resources page.
-- Apply after: 2026_02_28_services_video_url.sql
-- ============================================================================

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS presentation_url TEXT;
