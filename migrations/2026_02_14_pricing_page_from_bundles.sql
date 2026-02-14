-- ============================================================================
-- Migration: Pricing Page From Bundles
-- Date: 2026-02-14
-- Purpose: Add pricing display columns to offer_bundles and backfill canonical
--          tiers so the pricing page can be driven by bundle data.
-- Dependencies: offer_bundles table, 2026_02_13_nonprofit_decoy_tiers
-- ============================================================================

-- ============================================================================
-- 1. Add new columns to offer_bundles
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'pricing_page_segments') THEN
    ALTER TABLE offer_bundles ADD COLUMN pricing_page_segments TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'pricing_tier_slug') THEN
    ALTER TABLE offer_bundles ADD COLUMN pricing_tier_slug TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'tagline') THEN
    ALTER TABLE offer_bundles ADD COLUMN tagline TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'target_audience_display') THEN
    ALTER TABLE offer_bundles ADD COLUMN target_audience_display TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'pricing_display_order') THEN
    ALTER TABLE offer_bundles ADD COLUMN pricing_display_order INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'is_featured') THEN
    ALTER TABLE offer_bundles ADD COLUMN is_featured BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'guarantee_name') THEN
    ALTER TABLE offer_bundles ADD COLUMN guarantee_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'guarantee_description') THEN
    ALTER TABLE offer_bundles ADD COLUMN guarantee_description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'cta_text') THEN
    ALTER TABLE offer_bundles ADD COLUMN cta_text TEXT DEFAULT 'Get Started';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_bundles' AND column_name = 'cta_href') THEN
    ALTER TABLE offer_bundles ADD COLUMN cta_href TEXT DEFAULT '#contact';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_offer_bundles_pricing_segments
  ON offer_bundles USING GIN (pricing_page_segments);

-- ============================================================================
-- 2. Backfill SMB tier bundles (by name - may not exist if seed not run)
-- ============================================================================
UPDATE offer_bundles SET
  pricing_page_segments = ARRAY['smb']::TEXT[],
  pricing_tier_slug = 'quick-win',
  tagline = 'Discover where AI fits in your business',
  target_audience_display = 'Solopreneurs and small teams (1-10 employees)',
  pricing_display_order = 0,
  is_featured = false,
  guarantee_name = 'Quick Win Guarantee',
  guarantee_description = 'Identify 3+ actionable AI opportunities or get a full refund. No questions asked.',
  cta_text = 'Get Started',
  cta_href = '#contact'
WHERE name = 'AI Quick Win' AND (bundle_type = 'standard' OR bundle_type IS NULL);

UPDATE offer_bundles SET
  pricing_page_segments = ARRAY['smb', 'midmarket']::TEXT[],
  pricing_tier_slug = 'accelerator',
  tagline = 'Deploy your first AI tools',
  target_audience_display = 'Small businesses ready to automate (1-25 employees)',
  pricing_display_order = 1,
  is_featured = true,
  guarantee_name = 'Accelerator Guarantee',
  guarantee_description = 'Save 10+ hours per week within 90 days or we continue coaching you for free until you do.',
  cta_text = 'Start Accelerating',
  cta_href = '#contact'
WHERE name = 'AI Accelerator' AND (bundle_type = 'standard' OR bundle_type IS NULL);

UPDATE offer_bundles SET
  pricing_page_segments = ARRAY['smb', 'midmarket']::TEXT[],
  pricing_tier_slug = 'growth-engine',
  tagline = 'AI across lead gen, sales, and operations',
  target_audience_display = 'Growing businesses scaling with AI (10-100 employees)',
  pricing_display_order = 2,
  is_featured = false,
  guarantee_name = 'Growth Engine Guarantee',
  guarantee_description = '3x ROI in year 1 or we continue supporting you at no additional cost.',
  cta_text = 'Start Growing',
  cta_href = '#contact'
WHERE name = 'Growth Engine' AND (bundle_type = 'standard' OR bundle_type IS NULL);

-- ============================================================================
-- 3. Mid-Market: Accelerator and Growth Engine already have midmarket in array from step 2
--    Add Digital Transformation for midmarket only
-- ============================================================================
UPDATE offer_bundles SET
  pricing_page_segments = ARRAY['midmarket']::TEXT[],
  pricing_tier_slug = 'digital-transformation',
  tagline = 'Comprehensive AI across your entire business',
  target_audience_display = 'Mid-market companies (50-500 employees)',
  pricing_display_order = 2,
  is_featured = false,
  guarantee_name = 'Transformation Guarantee',
  guarantee_description = 'Measurable efficiency gains within 90 days AND 5x ROI within 18 months, or continued support at no cost.',
  cta_text = 'Schedule a Call',
  cta_href = '#contact'
WHERE name = 'Digital Transformation' AND (bundle_type = 'standard' OR bundle_type IS NULL);

-- ============================================================================
-- 4. Backfill Nonprofit (Community Impact) tier bundles
-- ============================================================================
UPDATE offer_bundles SET
  pricing_page_segments = ARRAY['nonprofit']::TEXT[],
  pricing_tier_slug = 'ci-starter',
  tagline = 'Discover where AI fits in your organization',
  target_audience_display = 'Nonprofits & educational institutions',
  pricing_display_order = 0,
  is_featured = false,
  guarantee_name = NULL,
  guarantee_description = NULL,
  cta_text = 'Get Started',
  cta_href = '#contact'
WHERE name = 'Community Impact Starter' AND bundle_type = 'decoy';

UPDATE offer_bundles SET
  pricing_page_segments = ARRAY['nonprofit']::TEXT[],
  pricing_tier_slug = 'ci-accelerator',
  tagline = 'Deploy your first AI tool',
  target_audience_display = 'Nonprofits & educational institutions',
  pricing_display_order = 1,
  is_featured = false,
  guarantee_name = NULL,
  guarantee_description = NULL,
  cta_text = 'Start Building',
  cta_href = '#contact'
WHERE name = 'Community Impact Accelerator' AND bundle_type = 'decoy';

UPDATE offer_bundles SET
  pricing_page_segments = ARRAY['nonprofit']::TEXT[],
  pricing_tier_slug = 'ci-growth',
  tagline = 'AI across lead gen, content, and operations',
  target_audience_display = 'Nonprofits & educational institutions',
  pricing_display_order = 2,
  is_featured = false,
  guarantee_name = NULL,
  guarantee_description = NULL,
  cta_text = 'Start Growing',
  cta_href = '#contact'
WHERE name = 'Community Impact Growth' AND bundle_type = 'decoy';

COMMENT ON COLUMN offer_bundles.pricing_page_segments IS 'Array of segments (smb, midmarket, nonprofit) where bundle appears on public pricing page. Empty = not shown (includes custom bundles).';
COMMENT ON COLUMN offer_bundles.pricing_tier_slug IS 'Stable identifier for pricing display and decoy mirroring (e.g. quick-win, ci-starter).';
