-- ============================================================================
-- Migration: Base Bundle ID (Bundle-within-Bundle)
-- Date: 2026-02-15
-- Purpose: Add base_bundle_id so bundles can include another bundle as their
--          base and only store delta (add-on) items. Enables cumulative
--          tier display (e.g. Accelerator = Quick Win + add-ons).
-- Dependencies: offer_bundles table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'base_bundle_id'
  ) THEN
    ALTER TABLE offer_bundles
      ADD COLUMN base_bundle_id UUID REFERENCES offer_bundles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_offer_bundles_base
  ON offer_bundles(base_bundle_id) WHERE base_bundle_id IS NOT NULL;

COMMENT ON COLUMN offer_bundles.base_bundle_id IS 'Optional. When set, this bundle includes all items from the base bundle plus its own bundle_items (add-ons only). Used for cumulative tiers (Accelerator builds on Quick Win, etc.).';
