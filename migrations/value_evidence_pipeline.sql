-- ============================================================================
-- Migration: Value Evidence Pipeline
-- Date: 2026-02-10
-- Purpose: Add tables for pain point tracking, market intelligence,
--          monetary calculations, and value reporting with full traceability
-- ============================================================================

-- ============================================================================
-- 1. Pain Point Categories - Dynamic master list
-- Grows as AI discovers new categories from social/internal data
-- ============================================================================
CREATE TABLE IF NOT EXISTS pain_point_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL UNIQUE,              -- e.g., "manual_data_entry"
  display_name TEXT NOT NULL,             -- e.g., "Manual Data Entry"
  description TEXT,                       -- What this pain point means

  -- Dynamic tags (populated by AI classifier)
  industry_tags TEXT[] DEFAULT '{}',      -- Which industries commonly have this
  frequency_count INTEGER DEFAULT 0,      -- How many times observed across all sources
  avg_monetary_impact DECIMAL(12,2),      -- Rolling average dollar impact

  -- Product/service mapping
  related_services TEXT[] DEFAULT '{}',   -- Maps to service types: training, consulting, etc.
  related_products BIGINT[] DEFAULT '{}', -- Maps to product IDs

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pain_point_categories_name
ON pain_point_categories(name);

CREATE INDEX IF NOT EXISTS idx_pain_point_categories_industry
ON pain_point_categories USING GIN(industry_tags);

CREATE INDEX IF NOT EXISTS idx_pain_point_categories_frequency
ON pain_point_categories(frequency_count DESC);

COMMENT ON TABLE pain_point_categories IS 'Dynamic master list of pain point types. Grows as AI discovers new categories from social media, diagnostics, and lead data.';
COMMENT ON COLUMN pain_point_categories.name IS 'Machine-readable slug e.g. manual_data_entry';
COMMENT ON COLUMN pain_point_categories.industry_tags IS 'Array of industries where this pain point commonly appears, populated dynamically';
COMMENT ON COLUMN pain_point_categories.frequency_count IS 'Total times this pain point has been observed across all evidence sources';
COMMENT ON COLUMN pain_point_categories.avg_monetary_impact IS 'Rolling average annual dollar impact across all calculations';

-- ============================================================================
-- 2. Market Intelligence - Raw scraped data from external sources
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  source_platform TEXT NOT NULL CHECK (source_platform IN (
    'linkedin', 'reddit', 'g2', 'capterra', 'trustradius',
    'facebook', 'twitter', 'google_maps', 'youtube', 'quora', 'other'
  )),
  source_url TEXT,                        -- Direct link to original post/review
  source_author TEXT,                     -- Who posted (anonymized if needed)

  -- Content
  content_text TEXT NOT NULL,             -- Raw content
  content_type TEXT NOT NULL CHECK (content_type IN (
    'post', 'comment', 'review', 'question', 'article', 'other'
  )),

  -- AI-extracted metadata
  industry_detected TEXT,                 -- Industry extracted from content
  company_size_detected TEXT,             -- e.g., "10-50"
  author_role_detected TEXT,              -- e.g., "business owner", "operations manager"
  monetary_mentions JSONB DEFAULT '[]',   -- [{"amount": 50000, "context": "we spend $50K/year on..."}]
  sentiment_score DECIMAL(4,3),           -- -1.000 to 1.000
  relevance_score INTEGER CHECK (relevance_score BETWEEN 0 AND 10),

  -- Processing status
  is_processed BOOLEAN DEFAULT false,     -- Whether pain points have been extracted
  processed_at TIMESTAMPTZ,

  -- Timestamps
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_intelligence_platform
ON market_intelligence(source_platform);

CREATE INDEX IF NOT EXISTS idx_market_intelligence_industry
ON market_intelligence(industry_detected)
WHERE industry_detected IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_market_intelligence_relevance
ON market_intelligence(relevance_score DESC)
WHERE relevance_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_market_intelligence_unprocessed
ON market_intelligence(is_processed, created_at)
WHERE is_processed = false;

COMMENT ON TABLE market_intelligence IS 'Raw scraped data from social media, review sites, and forums. Source of truth for external pain point evidence.';
COMMENT ON COLUMN market_intelligence.monetary_mentions IS 'JSON array of dollar amounts found in content: [{amount, context}]';
COMMENT ON COLUMN market_intelligence.relevance_score IS '0-10 relevance to our services, scored by AI classifier';

-- ============================================================================
-- 3. Pain Point Evidence - Classified pain points with source traceability
-- The core link between raw data and monetary calculations
-- ============================================================================
CREATE TABLE IF NOT EXISTS pain_point_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  pain_point_category_id UUID NOT NULL REFERENCES pain_point_categories(id) ON DELETE CASCADE,

  -- Source traceability
  source_type TEXT NOT NULL CHECK (source_type IN (
    'market_intelligence',    -- From social scraping
    'diagnostic_audit',       -- From diagnostic assessments
    'lead_enrichment',        -- From lead quick_wins / full_report
    'outreach_reply',         -- From outreach reply content
    'manual'                  -- Manually entered by admin
  )),
  source_id TEXT NOT NULL,                -- ID of the source record
  source_excerpt TEXT NOT NULL,           -- The specific text evidencing this pain point

  -- Context
  industry TEXT,                          -- Industry of the affected business
  company_size TEXT,                      -- Employee count range
  monetary_indicator DECIMAL(12,2),       -- Dollar amount directly stated (if any)
  monetary_context TEXT,                  -- Context around the dollar amount

  -- Quality
  confidence_score DECIMAL(4,3) NOT NULL DEFAULT 0.5, -- 0-1.0
  extracted_by TEXT NOT NULL DEFAULT 'ai_classifier'
    CHECK (extracted_by IN ('ai_classifier', 'manual', 'enrichment_agent')),

  -- Optional lead link
  contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pain_point_evidence_category
ON pain_point_evidence(pain_point_category_id);

CREATE INDEX IF NOT EXISTS idx_pain_point_evidence_source
ON pain_point_evidence(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_pain_point_evidence_industry
ON pain_point_evidence(industry)
WHERE industry IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pain_point_evidence_contact
ON pain_point_evidence(contact_submission_id)
WHERE contact_submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pain_point_evidence_confidence
ON pain_point_evidence(confidence_score DESC);

COMMENT ON TABLE pain_point_evidence IS 'Classified pain points with full source traceability. Each record links a specific excerpt to a pain point category.';
COMMENT ON COLUMN pain_point_evidence.source_type IS 'Where this evidence came from: market_intelligence, diagnostic_audit, lead_enrichment, outreach_reply, or manual';
COMMENT ON COLUMN pain_point_evidence.source_id IS 'Primary key of the source record for full traceability';
COMMENT ON COLUMN pain_point_evidence.confidence_score IS '0-1.0 confidence that this excerpt represents the classified pain point';

-- ============================================================================
-- 4. Industry Benchmarks - Reference data for monetary calculations
-- ============================================================================
CREATE TABLE IF NOT EXISTS industry_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dimensions
  industry TEXT NOT NULL,                 -- Dynamic, matches industries from leads
  company_size_range TEXT NOT NULL,       -- e.g., "1-10", "11-50", "51-200", "201-1000"

  -- Benchmark data
  benchmark_type TEXT NOT NULL CHECK (benchmark_type IN (
    'avg_hourly_wage',        -- Average wage for workers doing the task
    'avg_error_cost',         -- Average cost per error/mistake
    'avg_daily_revenue',      -- Average daily revenue for this segment
    'avg_employee_cost',      -- Average fully-loaded employee cost (salary + benefits)
    'avg_tool_spend',         -- Average annual spend on tools/software
    'avg_lead_value',         -- Average value of a qualified lead
    'avg_deal_size',          -- Average deal/sale value
    'avg_close_rate'          -- Average close rate (as decimal)
  )),
  value DECIMAL(12,2) NOT NULL,

  -- Provenance
  source TEXT NOT NULL,                   -- e.g., "BLS", "Glassdoor", "IBISWorld"
  source_url TEXT,                        -- Link to data source
  year INTEGER NOT NULL,                  -- Year of the data

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_industry_benchmarks_unique
ON industry_benchmarks(industry, company_size_range, benchmark_type, year);

CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_industry
ON industry_benchmarks(industry);

CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_type
ON industry_benchmarks(benchmark_type);

COMMENT ON TABLE industry_benchmarks IS 'Reference data for monetary calculations. Sourced from BLS, Glassdoor, IBISWorld, etc.';
COMMENT ON COLUMN industry_benchmarks.company_size_range IS 'Employee count range matching contact_submissions.employee_count';
COMMENT ON COLUMN industry_benchmarks.value IS 'Dollar amount or rate (for avg_close_rate, stored as decimal e.g. 0.15 for 15%)';

-- ============================================================================
-- 5. Value Calculations - Monetary equivalence with full formula traceability
-- ============================================================================
CREATE TABLE IF NOT EXISTS value_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What this calculates
  pain_point_category_id UUID NOT NULL REFERENCES pain_point_categories(id) ON DELETE CASCADE,
  industry TEXT NOT NULL,
  company_size_range TEXT NOT NULL,

  -- Calculation details
  calculation_method TEXT NOT NULL CHECK (calculation_method IN (
    'time_saved',             -- Hours x Hourly rate x Weeks
    'error_reduction',        -- Error rate x Cost per error x Volume
    'revenue_acceleration',   -- Days faster x Daily revenue impact
    'opportunity_cost',       -- Missed leads x Deal value x Close rate
    'replacement_cost'        -- FTE count x Salary x Benefits multiplier
  )),
  formula_inputs JSONB NOT NULL,          -- Full inputs used in calculation
  formula_expression TEXT NOT NULL,       -- Human-readable formula string
  annual_value DECIMAL(12,2) NOT NULL,    -- Calculated result

  -- Quality indicators
  confidence_level TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence_level IN ('high', 'medium', 'low')),
  evidence_count INTEGER DEFAULT 0,       -- Supporting evidence records
  benchmark_ids UUID[] DEFAULT '{}',      -- Which benchmarks were used
  evidence_ids UUID[] DEFAULT '{}',       -- Which evidence records support this

  -- Provenance
  generated_by TEXT NOT NULL DEFAULT 'system'
    CHECK (generated_by IN ('system', 'manual', 'ai')),

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_value_calculations_pain_point
ON value_calculations(pain_point_category_id);

CREATE INDEX IF NOT EXISTS idx_value_calculations_industry
ON value_calculations(industry, company_size_range);

CREATE INDEX IF NOT EXISTS idx_value_calculations_method
ON value_calculations(calculation_method);

CREATE INDEX IF NOT EXISTS idx_value_calculations_value
ON value_calculations(annual_value DESC);

CREATE INDEX IF NOT EXISTS idx_value_calculations_active
ON value_calculations(is_active, industry, company_size_range)
WHERE is_active = true;

COMMENT ON TABLE value_calculations IS 'Monetary equivalence calculations with full formula traceability. Each record represents one pain point -> dollar value calculation for a specific industry/size segment.';
COMMENT ON COLUMN value_calculations.formula_inputs IS 'Full JSON inputs: {"hours_per_week": 10, "hourly_rate": 50, "weeks_per_year": 52}';
COMMENT ON COLUMN value_calculations.formula_expression IS 'Human-readable: "hours_per_week * hourly_rate * weeks_per_year"';
COMMENT ON COLUMN value_calculations.confidence_level IS 'Based on evidence count + benchmark data quality: high (5+ evidence, verified benchmarks), medium (2-4 evidence), low (1 evidence or estimated benchmarks)';

-- ============================================================================
-- 6. Value Reports - Generated reports (internal + client-facing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS value_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('internal_audit', 'client_facing')),

  -- Dimensions
  industry TEXT,
  company_size_range TEXT,

  -- Content
  title TEXT NOT NULL,
  summary_markdown TEXT NOT NULL,         -- Full report in Markdown
  value_statements JSONB NOT NULL DEFAULT '[]',
  -- Structure: [{
  --   pain_point: "Manual Data Entry",
  --   annual_value: 23400,
  --   calculation_method: "time_saved",
  --   formula_readable: "10 hrs/week × $45/hr × 52 weeks",
  --   evidence_summary: "Based on 14 data points from 8 businesses",
  --   confidence: "high"
  -- }]

  total_annual_value DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Traceability
  calculation_ids UUID[] DEFAULT '{}',
  evidence_chain JSONB NOT NULL DEFAULT '{}',
  -- Structure: {
  --   raw_sources: [{ type, id, platform, url, excerpt }],
  --   classifications: [{ evidence_id, category, confidence }],
  --   calculations: [{ id, method, formula, annual_value, benchmarks_used }]
  -- }

  -- Provenance
  generated_by TEXT NOT NULL DEFAULT 'ai'
    CHECK (generated_by IN ('ai', 'manual')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_value_reports_contact
ON value_reports(contact_submission_id)
WHERE contact_submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_value_reports_type
ON value_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_value_reports_industry
ON value_reports(industry)
WHERE industry IS NOT NULL;

COMMENT ON TABLE value_reports IS 'Generated value assessment reports with full evidence chain traceability.';
COMMENT ON COLUMN value_reports.evidence_chain IS 'Complete traversal from raw sources -> classifications -> calculations for full auditability';
COMMENT ON COLUMN value_reports.value_statements IS 'Array of value statements with pain point, dollar amount, method, and confidence';

-- ============================================================================
-- 7. Content Pain Point Map - Links products/services to pain points they solve
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_pain_point_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content reference (polymorphic)
  content_type TEXT NOT NULL CHECK (content_type IN (
    'product', 'service', 'project', 'video', 'publication',
    'music', 'lead_magnet', 'prototype'
  )),
  content_id TEXT NOT NULL,               -- Product or service ID

  -- Pain point link
  pain_point_category_id UUID NOT NULL REFERENCES pain_point_categories(id) ON DELETE CASCADE,

  -- Impact
  impact_percentage INTEGER NOT NULL DEFAULT 100
    CHECK (impact_percentage BETWEEN 1 AND 100),  -- What % of the pain point this solves
  notes TEXT,                             -- How this content addresses the pain point

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate mappings
  UNIQUE(content_type, content_id, pain_point_category_id)
);

CREATE INDEX IF NOT EXISTS idx_content_pain_point_map_content
ON content_pain_point_map(content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_content_pain_point_map_pain_point
ON content_pain_point_map(pain_point_category_id);

COMMENT ON TABLE content_pain_point_map IS 'Explicit mapping between products/services and the pain points they solve. Supports partial impact percentages.';
COMMENT ON COLUMN content_pain_point_map.impact_percentage IS 'What percentage of the pain point this content solves (default 100). Allows a bundle to partially address multiple pain points.';

-- ============================================================================
-- 8. Add value_report_id to proposals table
-- ============================================================================
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS value_report_id UUID REFERENCES value_reports(id) ON DELETE SET NULL;

COMMENT ON COLUMN proposals.value_report_id IS 'Links proposal to its auto-generated value assessment for client-facing evidence';

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE pain_point_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE pain_point_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pain_point_map ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies - Admin access for management tables
-- ============================================================================

-- Pain Point Categories - Admin can manage, service role for n8n ingestion
DROP POLICY IF EXISTS "Admins can manage pain point categories" ON pain_point_categories;
CREATE POLICY "Admins can manage pain point categories"
  ON pain_point_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Market Intelligence - Admin only
DROP POLICY IF EXISTS "Admins can manage market intelligence" ON market_intelligence;
CREATE POLICY "Admins can manage market intelligence"
  ON market_intelligence FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Pain Point Evidence - Admin only
DROP POLICY IF EXISTS "Admins can manage pain point evidence" ON pain_point_evidence;
CREATE POLICY "Admins can manage pain point evidence"
  ON pain_point_evidence FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Industry Benchmarks - Admin only
DROP POLICY IF EXISTS "Admins can manage industry benchmarks" ON industry_benchmarks;
CREATE POLICY "Admins can manage industry benchmarks"
  ON industry_benchmarks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Value Calculations - Admin only
DROP POLICY IF EXISTS "Admins can manage value calculations" ON value_calculations;
CREATE POLICY "Admins can manage value calculations"
  ON value_calculations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Value Reports - Admin can manage all, public can read client-facing by ID
DROP POLICY IF EXISTS "Admins can manage value reports" ON value_reports;
CREATE POLICY "Admins can manage value reports"
  ON value_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Content Pain Point Map - Admin only
DROP POLICY IF EXISTS "Admins can manage content pain point map" ON content_pain_point_map;
CREATE POLICY "Admins can manage content pain point map"
  ON content_pain_point_map FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_value_pipeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pain_point_categories_updated_at ON pain_point_categories;
CREATE TRIGGER pain_point_categories_updated_at
  BEFORE UPDATE ON pain_point_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_value_pipeline_updated_at();

DROP TRIGGER IF EXISTS industry_benchmarks_updated_at ON industry_benchmarks;
CREATE TRIGGER industry_benchmarks_updated_at
  BEFORE UPDATE ON industry_benchmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_value_pipeline_updated_at();

DROP TRIGGER IF EXISTS value_calculations_updated_at ON value_calculations;
CREATE TRIGGER value_calculations_updated_at
  BEFORE UPDATE ON value_calculations
  FOR EACH ROW
  EXECUTE FUNCTION update_value_pipeline_updated_at();

-- ============================================================================
-- Helper Views
-- ============================================================================

-- View: Aggregated pain points by industry with evidence counts and avg value
CREATE OR REPLACE VIEW value_evidence_summary AS
SELECT
  ppc.id AS category_id,
  ppc.name AS category_name,
  ppc.display_name,
  ppc.description,
  ppe.industry,
  COUNT(ppe.id) AS evidence_count,
  COUNT(DISTINCT ppe.source_type) AS source_type_count,
  AVG(ppe.confidence_score) AS avg_confidence,
  COUNT(ppe.monetary_indicator) FILTER (WHERE ppe.monetary_indicator IS NOT NULL) AS monetary_evidence_count,
  AVG(ppe.monetary_indicator) FILTER (WHERE ppe.monetary_indicator IS NOT NULL) AS avg_monetary_indicator
FROM pain_point_categories ppc
LEFT JOIN pain_point_evidence ppe ON ppc.id = ppe.pain_point_category_id
WHERE ppc.is_active = true
GROUP BY ppc.id, ppc.name, ppc.display_name, ppc.description, ppe.industry
ORDER BY COUNT(ppe.id) DESC;

COMMENT ON VIEW value_evidence_summary IS 'Aggregated pain points by industry showing evidence counts, confidence, and monetary indicators.';

-- View: Top monetary impacts by industry
CREATE OR REPLACE VIEW value_calculation_summary AS
SELECT
  vc.id AS calculation_id,
  ppc.display_name AS pain_point,
  vc.industry,
  vc.company_size_range,
  vc.calculation_method,
  vc.formula_expression,
  vc.annual_value,
  vc.confidence_level,
  vc.evidence_count,
  array_length(vc.benchmark_ids, 1) AS benchmark_count
FROM value_calculations vc
JOIN pain_point_categories ppc ON vc.pain_point_category_id = ppc.id
WHERE vc.is_active = true
ORDER BY vc.annual_value DESC;

COMMENT ON VIEW value_calculation_summary IS 'Top monetary impacts by industry showing calculation details, confidence, and evidence counts.';

-- View: Content with mapped pain points and their calculated values
CREATE OR REPLACE VIEW content_value_map AS
SELECT
  cpm.content_type,
  cpm.content_id,
  cpm.impact_percentage,
  ppc.id AS pain_point_id,
  ppc.display_name AS pain_point_name,
  ppc.avg_monetary_impact,
  vc.annual_value AS best_calculation_value,
  vc.industry AS calculation_industry,
  vc.company_size_range AS calculation_size,
  vc.calculation_method,
  vc.confidence_level
FROM content_pain_point_map cpm
JOIN pain_point_categories ppc ON cpm.pain_point_category_id = ppc.id
LEFT JOIN LATERAL (
  SELECT annual_value, industry, company_size_range, calculation_method, confidence_level
  FROM value_calculations
  WHERE pain_point_category_id = ppc.id
    AND is_active = true
  ORDER BY annual_value DESC
  LIMIT 1
) vc ON true
WHERE ppc.is_active = true
ORDER BY cpm.content_type, cpm.content_id, vc.annual_value DESC NULLS LAST;

COMMENT ON VIEW content_value_map IS 'Products/services mapped to their pain points with best available monetary calculations.';

-- ============================================================================
-- Seed Data: Initial Pain Point Categories
-- These are common pain points for B2B AI/automation consulting
-- ============================================================================
INSERT INTO pain_point_categories (name, display_name, description, related_services, industry_tags) VALUES
  ('manual_data_entry', 'Manual Data Entry', 'Time spent on repetitive data entry tasks that could be automated', ARRAY['consulting', 'training'], ARRAY['professional_services', 'healthcare', 'finance']),
  ('slow_response_times', 'Slow Client Response Times', 'Delayed responses to client inquiries leading to lost opportunities', ARRAY['consulting', 'coaching'], ARRAY['professional_services', 'ecommerce', 'saas']),
  ('inconsistent_followup', 'Inconsistent Follow-up', 'Leads falling through the cracks due to lack of systematic follow-up', ARRAY['consulting', 'training'], ARRAY['professional_services', 'real_estate', 'insurance']),
  ('scattered_tools', 'Scattered Tools & Data Silos', 'Using multiple disconnected tools leading to lost context and double-work', ARRAY['consulting', 'training'], ARRAY['saas', 'professional_services', 'ecommerce']),
  ('manual_reporting', 'Manual Reporting & Analytics', 'Hours spent creating reports that could be auto-generated', ARRAY['consulting', 'training'], ARRAY['finance', 'marketing', 'professional_services']),
  ('poor_lead_qualification', 'Poor Lead Qualification', 'Wasting time on unqualified leads due to lack of scoring/filtering', ARRAY['consulting', 'coaching'], ARRAY['saas', 'professional_services', 'real_estate']),
  ('knowledge_loss', 'Tribal Knowledge & Documentation Gaps', 'Critical business knowledge lives in peoples heads, not systems', ARRAY['training', 'consulting'], ARRAY['manufacturing', 'professional_services', 'healthcare']),
  ('scaling_bottlenecks', 'Scaling Bottlenecks', 'Manual processes preventing business growth beyond current capacity', ARRAY['consulting', 'coaching'], ARRAY['ecommerce', 'saas', 'professional_services']),
  ('employee_onboarding', 'Slow Employee Onboarding', 'New hires take too long to become productive due to poor systems', ARRAY['training', 'consulting'], ARRAY['professional_services', 'retail', 'healthcare']),
  ('customer_churn', 'Preventable Customer Churn', 'Losing customers due to reactive rather than proactive engagement', ARRAY['consulting', 'coaching'], ARRAY['saas', 'ecommerce', 'professional_services'])
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Seed Data: Baseline Industry Benchmarks
-- These are approximate averages for calculation seeding
-- ============================================================================
INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year, notes) VALUES
  -- Professional Services
  ('professional_services', '1-10',   'avg_hourly_wage', 35.00,  'BLS', 2025, 'Average for admin/operations roles in small firms'),
  ('professional_services', '11-50',  'avg_hourly_wage', 45.00,  'BLS', 2025, 'Average for mid-level operations roles'),
  ('professional_services', '51-200', 'avg_hourly_wage', 55.00,  'BLS', 2025, 'Average for specialized operations roles'),
  ('professional_services', '1-10',   'avg_employee_cost', 55000.00, 'BLS', 2025, 'Fully loaded cost (salary + benefits + overhead)'),
  ('professional_services', '11-50',  'avg_employee_cost', 75000.00, 'BLS', 2025, 'Fully loaded cost'),
  ('professional_services', '51-200', 'avg_employee_cost', 95000.00, 'BLS', 2025, 'Fully loaded cost'),
  ('professional_services', '11-50',  'avg_error_cost', 500.00,  'Industry estimate', 2025, 'Average cost per operational error'),
  ('professional_services', '11-50',  'avg_daily_revenue', 2500.00, 'Industry estimate', 2025, 'Average daily revenue for mid-size firm'),
  ('professional_services', '11-50',  'avg_lead_value', 850.00,  'Industry estimate', 2025, 'Average value of a qualified lead'),
  ('professional_services', '11-50',  'avg_deal_size', 8500.00,  'Industry estimate', 2025, 'Average deal/engagement value'),
  ('professional_services', '11-50',  'avg_close_rate', 0.25,    'Industry estimate', 2025, '25% average close rate'),

  -- SaaS / Technology
  ('saas', '1-10',   'avg_hourly_wage', 45.00,  'Glassdoor', 2025, 'Average for startup operations roles'),
  ('saas', '11-50',  'avg_hourly_wage', 55.00,  'Glassdoor', 2025, 'Average for growth-stage ops/eng roles'),
  ('saas', '51-200', 'avg_hourly_wage', 65.00,  'Glassdoor', 2025, 'Average for scale-up stage roles'),
  ('saas', '11-50',  'avg_employee_cost', 95000.00, 'Glassdoor', 2025, 'Fully loaded cost'),
  ('saas', '11-50',  'avg_error_cost', 1000.00, 'Industry estimate', 2025, 'Average cost per bug/downtime incident'),
  ('saas', '11-50',  'avg_daily_revenue', 5000.00, 'Industry estimate', 2025, 'Average daily ARR equivalent'),
  ('saas', '11-50',  'avg_lead_value', 1200.00, 'Industry estimate', 2025, 'Average SaaS lead value'),
  ('saas', '11-50',  'avg_deal_size', 15000.00, 'Industry estimate', 2025, 'Average annual contract value'),
  ('saas', '11-50',  'avg_close_rate', 0.20,    'Industry estimate', 2025, '20% average close rate'),

  -- E-commerce
  ('ecommerce', '1-10',   'avg_hourly_wage', 25.00,  'BLS', 2025, 'Average for small ecommerce operations'),
  ('ecommerce', '11-50',  'avg_hourly_wage', 35.00,  'BLS', 2025, 'Average for mid-size ecommerce operations'),
  ('ecommerce', '11-50',  'avg_employee_cost', 60000.00, 'BLS', 2025, 'Fully loaded cost'),
  ('ecommerce', '11-50',  'avg_error_cost', 250.00,  'Industry estimate', 2025, 'Average cost per order error'),
  ('ecommerce', '11-50',  'avg_daily_revenue', 8000.00, 'Industry estimate', 2025, 'Average daily revenue'),
  ('ecommerce', '11-50',  'avg_lead_value', 45.00,   'Industry estimate', 2025, 'Average ecommerce lead/visitor value'),

  -- Healthcare
  ('healthcare', '1-10',   'avg_hourly_wage', 30.00,  'BLS', 2025, 'Average for admin roles in small practices'),
  ('healthcare', '11-50',  'avg_hourly_wage', 40.00,  'BLS', 2025, 'Average for mid-level healthcare admin'),
  ('healthcare', '11-50',  'avg_employee_cost', 70000.00, 'BLS', 2025, 'Fully loaded cost'),
  ('healthcare', '11-50',  'avg_error_cost', 2000.00, 'Industry estimate', 2025, 'Average cost per clinical/billing error'),

  -- Cross-industry defaults (fallback)
  ('_default', '1-10',   'avg_hourly_wage', 30.00,  'BLS national average', 2025, 'Fallback for unknown industries'),
  ('_default', '11-50',  'avg_hourly_wage', 40.00,  'BLS national average', 2025, 'Fallback for unknown industries'),
  ('_default', '51-200', 'avg_hourly_wage', 50.00,  'BLS national average', 2025, 'Fallback for unknown industries'),
  ('_default', '1-10',   'avg_employee_cost', 50000.00, 'BLS national average', 2025, 'Fallback'),
  ('_default', '11-50',  'avg_employee_cost', 65000.00, 'BLS national average', 2025, 'Fallback'),
  ('_default', '51-200', 'avg_employee_cost', 85000.00, 'BLS national average', 2025, 'Fallback'),
  ('_default', '11-50',  'avg_error_cost', 500.00,  'General estimate', 2025, 'Fallback'),
  ('_default', '11-50',  'avg_daily_revenue', 3000.00, 'General estimate', 2025, 'Fallback'),
  ('_default', '11-50',  'avg_lead_value', 500.00,  'General estimate', 2025, 'Fallback'),
  ('_default', '11-50',  'avg_deal_size', 5000.00,  'General estimate', 2025, 'Fallback'),
  ('_default', '11-50',  'avg_close_rate', 0.20,    'General estimate', 2025, 'Fallback 20%')
ON CONFLICT DO NOTHING;
