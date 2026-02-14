-- ============================================================================
-- Migration: CI Starter Free
-- Date: 2026-02-13
-- Purpose: Set Community Impact Starter tier to free ($0).
-- Dependencies: 2026_02_13_nonprofit_decoy_tiers.sql (offer_bundles, services)
-- ============================================================================

-- Update Community Impact Starter bundle to free
UPDATE offer_bundles
SET bundle_price = 0,
    updated_at = NOW()
WHERE name = 'Community Impact Starter';

-- Update the AI Strategy Workshop — Recorded service to free (CI Starter core component)
UPDATE services
SET price = 0,
    updated_at = NOW()
WHERE title = 'AI Strategy Workshop — Recorded (Self-Paced)';
