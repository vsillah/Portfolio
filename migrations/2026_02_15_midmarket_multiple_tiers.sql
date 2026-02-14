-- ============================================================================
-- Migration: Mid-Market multiple tiers
-- Date: 2026-02-15
-- Purpose: Add Accelerator and Growth Engine to Mid-Market segment so all
--          three SMB tiers (Accelerator, Growth Engine, Digital Transformation)
--          appear when Mid-Market is selected.
-- ============================================================================

UPDATE offer_bundles SET pricing_page_segments = ARRAY['smb', 'midmarket']::TEXT[]
WHERE name IN ('AI Accelerator', 'Growth Engine')
  AND (pricing_page_segments IS NULL OR NOT ('midmarket' = ANY(pricing_page_segments)));
