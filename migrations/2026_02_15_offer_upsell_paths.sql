-- ============================================================================
-- Migration: Offer Upsell Paths
-- Date: 2026-02-15
-- Purpose: Create the offer_upsell_paths table for configurable, offer-level
--          upsell pairings. Each row maps a source offer (decoy or entry-level)
--          to its predicted "next problem" and the premium upsell that solves it.
--          Follows the $100M Offers two-touch prescription model.
-- Dependencies: sales_scripts table must exist
-- ============================================================================

-- ============================================================================
-- 1. Create offer_upsell_paths table
-- ============================================================================

CREATE TABLE IF NOT EXISTS offer_upsell_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source offer (the decoy or entry-level item)
  source_content_type TEXT NOT NULL,       -- 'product', 'service', 'lead_magnet', etc.
  source_content_id TEXT NOT NULL,         -- ID in the source table
  source_title TEXT NOT NULL,              -- Display name (denormalized for admin UI)
  source_tier_slug TEXT,                   -- Optional: which bundle tier this belongs to

  -- The predicted next problem
  next_problem TEXT NOT NULL,              -- 1-2 sentence pain description
  next_problem_timing TEXT NOT NULL DEFAULT '2-4 weeks', -- When they typically hit it
  next_problem_signals JSONB DEFAULT '[]', -- Observable signals (support tickets, usage patterns)

  -- The premium upsell that solves it
  upsell_content_type TEXT NOT NULL,
  upsell_content_id TEXT NOT NULL,
  upsell_title TEXT NOT NULL,              -- Display name (denormalized)
  upsell_tier_slug TEXT,                   -- Optional: which bundle tier this belongs to
  upsell_perceived_value NUMERIC,          -- Dollar value for scripts/proposals

  -- Script content (JSONB, same structure as sales_scripts.script_content.steps)
  point_of_sale_steps JSONB DEFAULT '[]',  -- Steps embedded in decoy presentation
  point_of_pain_steps JSONB DEFAULT '[]',  -- Steps for follow-up script

  -- Incremental value framing
  incremental_cost NUMERIC,                -- Price difference (upsell tier - source tier)
  incremental_value NUMERIC,               -- Perceived value difference
  value_frame_text TEXT,                    -- Pre-written value frame sentence
  risk_reversal_text TEXT,                  -- Pre-written guarantee/risk reversal

  -- Credit policy
  credit_previous_investment BOOLEAN DEFAULT true,  -- Source investment applies as credit
  credit_note TEXT,                         -- e.g., "Your $1,997 applies toward the Accelerator"

  -- Script references (optional FK to sales_scripts for full standalone scripts)
  point_of_sale_script_id UUID REFERENCES sales_scripts(id) ON DELETE SET NULL,
  point_of_pain_script_id UUID REFERENCES sales_scripts(id) ON DELETE SET NULL,

  -- Admin metadata
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,                               -- Internal admin notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_upsell_paths_source
  ON offer_upsell_paths(source_content_type, source_content_id);

CREATE INDEX IF NOT EXISTS idx_upsell_paths_upsell
  ON offer_upsell_paths(upsell_content_type, upsell_content_id);

CREATE INDEX IF NOT EXISTS idx_upsell_paths_source_tier
  ON offer_upsell_paths(source_tier_slug);

CREATE INDEX IF NOT EXISTS idx_upsell_paths_active
  ON offer_upsell_paths(is_active) WHERE is_active = true;

-- ============================================================================
-- 3. RLS
-- ============================================================================

ALTER TABLE offer_upsell_paths ENABLE ROW LEVEL SECURITY;

-- Admins can manage all upsell paths
DROP POLICY IF EXISTS "Admins can manage upsell paths" ON offer_upsell_paths;
CREATE POLICY "Admins can manage upsell paths"
  ON offer_upsell_paths FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Public can view active upsell paths (needed for pricing page, proposals)
DROP POLICY IF EXISTS "Public can view active upsell paths" ON offer_upsell_paths;
CREATE POLICY "Public can view active upsell paths"
  ON offer_upsell_paths FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- 4. Updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_offer_upsell_paths_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS offer_upsell_paths_updated_at ON offer_upsell_paths;
CREATE TRIGGER offer_upsell_paths_updated_at
  BEFORE UPDATE ON offer_upsell_paths
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_upsell_paths_updated_at();
