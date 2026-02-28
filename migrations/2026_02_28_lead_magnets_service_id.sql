-- ============================================================================
-- Migration: Add service_id to lead_magnets for "service video as lead magnet"
-- Date: 2026-02-28
-- Purpose: When set, the lead magnet represents "watch this service's video";
--          video URL is resolved from the linked service.
-- Apply after: 2026_02_28_services_video_url.sql
-- ============================================================================

ALTER TABLE lead_magnets
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lead_magnets_service_id
  ON lead_magnets(service_id) WHERE service_id IS NOT NULL;
