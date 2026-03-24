-- ============================================================================
-- Migration: Actionable Audit Deliverable — Phase 1
-- Date: 2026-03-24
-- Purpose:
--   Add context-capture and enrichment columns to diagnostic_audits so the
--   audit tool can collect business context (URL, email, industry) upfront,
--   enrich with BuiltWith data, compute value estimates, and later store
--   screenshot/annotation data for visual analysis (Phase 2).
-- ============================================================================

-- 1. Business context captured at Step 0
ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 2. Industry classification (links to gics_industries reference table)
ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS industry_slug TEXT,
  ADD COLUMN IF NOT EXISTS industry_gics_code VARCHAR(6) REFERENCES gics_industries(gics_code);

-- 3. Enrichment data from BuiltWith / external analysis
ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS enriched_tech_stack JSONB DEFAULT '{}';

COMMENT ON COLUMN diagnostic_audits.enriched_tech_stack IS 'BuiltWith-detected technologies for the prospect website. Separate from self-reported tech_stack.';

-- 4. Value estimate computed from audit answers + industry benchmarks
ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS value_estimate JSONB DEFAULT '{}';

COMMENT ON COLUMN diagnostic_audits.value_estimate IS 'Computed value estimate: { annualValue, paybackMonths, calculations[], benchmarksUsed[], tier }';

-- 5. Report tier tracking
ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS report_tier TEXT DEFAULT 'bronze'
    CHECK (report_tier IN ('bronze', 'silver', 'gold', 'platinum'));

COMMENT ON COLUMN diagnostic_audits.report_tier IS 'Laddered report tier based on data completeness: bronze (partial) → silver (complete + email) → gold (+ URL + industry) → platinum (+ generated deck)';

-- 6. Phase 2 prep: screenshot and annotation storage
ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS website_screenshot_path TEXT,
  ADD COLUMN IF NOT EXISTS website_annotations JSONB DEFAULT '[]';

COMMENT ON COLUMN diagnostic_audits.website_screenshot_path IS 'Supabase Storage path for the captured website screenshot (Phase 2)';
COMMENT ON COLUMN diagnostic_audits.website_annotations IS 'AI-generated annotation overlays for the website screenshot: [{ x, y, width, height, label, recommendation }]';

-- 7. Index for looking up audits by email (for lead dedup and pipeline)
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_contact_email
  ON diagnostic_audits (contact_email)
  WHERE contact_email IS NOT NULL;

-- 8. Index for report tier queries (admin filtering)
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_report_tier
  ON diagnostic_audits (report_tier);
