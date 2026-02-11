-- ============================================================================
-- Migration: Create offer_bundles table
-- Date: 2026-02-10
-- Purpose: Add offer_bundles so Admin > Sales > Bundles API and UI work.
-- Run this in Supabase SQL Editor (or apply via your migration process).
-- ============================================================================

CREATE TABLE IF NOT EXISTS offer_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Bundle contents (JSONB array of { content_type, content_id, display_order, overrides... })
  bundle_items JSONB NOT NULL DEFAULT '[]',

  -- Pricing
  total_retail_value DECIMAL(10,2),
  total_perceived_value DECIMAL(10,2),
  bundle_price DECIMAL(10,2),
  default_discount_percent DECIMAL(5,2),

  -- Fork/parent (for "Save as" custom bundles)
  parent_bundle_id UUID REFERENCES offer_bundles(id),
  bundle_type TEXT DEFAULT 'standard',

  -- Target and metadata
  target_funnel_stages TEXT[] DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_bundles_active ON offer_bundles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_offer_bundles_parent ON offer_bundles(parent_bundle_id) WHERE parent_bundle_id IS NOT NULL;

ALTER TABLE offer_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage offer bundles" ON offer_bundles;
CREATE POLICY "Admins can manage offer bundles"
  ON offer_bundles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public can view active bundles" ON offer_bundles;
CREATE POLICY "Public can view active bundles"
  ON offer_bundles FOR SELECT
  USING (is_active = true);

CREATE OR REPLACE FUNCTION update_offer_bundles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS offer_bundles_updated_at ON offer_bundles;
DROP TRIGGER IF EXISTS trigger_offer_bundles_updated_at ON offer_bundles;
CREATE TRIGGER offer_bundles_updated_at
  BEFORE UPDATE ON offer_bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_bundles_updated_at();

COMMENT ON TABLE offer_bundles IS 'Pre-configured offer templates for sales calls (Grand Slam / bundles).';
