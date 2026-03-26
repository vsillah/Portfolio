-- ============================================================================
-- Migration: GICS Industry Classification Framework
-- Date: 2026-03-23
-- Purpose:
--   1. Create gics_industries reference table with GICS Industry-tier codes
--   2. Add gics_code column to industry_benchmarks, value_calculations,
--      value_reports, pain_point_evidence
--   3. Backfill gics_code on all existing rows using slug-to-GICS mapping
--   4. Seed industry_benchmarks for management_consulting and nonprofit
--   5. Update pain_point_categories.industry_tags for new industries
--
-- GICS reference: https://www.msci.com/indexes/index-resources/gics
-- ============================================================================

-- ============================================================================
-- 1. GICS Industries Reference Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS gics_industries (
  gics_code VARCHAR(6) PRIMARY KEY,
  name TEXT NOT NULL,
  sector_code VARCHAR(2) NOT NULL,
  sector_name TEXT NOT NULL,
  industry_group_code VARCHAR(4),
  industry_group_name TEXT,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE gics_industries IS 'Reference table for GICS Industry-tier classifications. Custom extensions (nonprofits, etc.) use codes in the 9xxxxx range.';
COMMENT ON COLUMN gics_industries.is_custom IS 'True for non-standard GICS codes (e.g. nonprofit) added as project extensions.';

-- Seed the GICS industries we use
INSERT INTO gics_industries (gics_code, name, sector_code, sector_name, industry_group_code, industry_group_name, is_custom) VALUES
  ('202020', 'Professional Services',                '20', 'Industrials',              '2020', 'Commercial & Professional Services', false),
  ('451030', 'Software',                             '45', 'Information Technology',    '4510', 'Software & Services',               false),
  ('255030', 'Broadline Retail',                     '25', 'Consumer Discretionary',    '2550', 'Consumer Discretionary Distribution & Retail', false),
  ('351020', 'Health Care Providers & Services',     '35', 'Health Care',              '3510', 'Health Care Equipment & Services',   false),
  ('402010', 'Financial Services',                   '40', 'Financials',               '4020', 'Financial Services',                 false),
  ('602010', 'Real Estate Management & Development', '60', 'Real Estate',              '6020', 'Real Estate Management & Development', false),
  ('403010', 'Insurance',                            '40', 'Financials',               '4030', 'Insurance',                          false),
  ('502010', 'Media',                                '50', 'Communication Services',   '5020', 'Media & Entertainment',              false),
  ('201060', 'Machinery',                            '20', 'Industrials',              '2010', 'Capital Goods',                      false),
  ('255040', 'Specialty Retail',                     '25', 'Consumer Discretionary',    '2550', 'Consumer Discretionary Distribution & Retail', false),
  ('253020', 'Diversified Consumer Services',        '25', 'Consumer Discretionary',    '2530', 'Consumer Services',                 false),
  -- Custom extensions
  ('900010', 'Nonprofit & Civic Organizations',      '90', 'Custom Extension',         '9000', 'Nonprofit',                          true),
  -- Fallback
  ('000000', 'Cross-Industry Default',               '00', 'Default',                  '0000', 'Default',                            true)
ON CONFLICT (gics_code) DO NOTHING;

-- ============================================================================
-- 2. Add gics_code columns to existing tables
-- ============================================================================

ALTER TABLE industry_benchmarks
  ADD COLUMN IF NOT EXISTS gics_code VARCHAR(6);

ALTER TABLE value_calculations
  ADD COLUMN IF NOT EXISTS gics_code VARCHAR(6);

ALTER TABLE value_reports
  ADD COLUMN IF NOT EXISTS gics_code VARCHAR(6);

ALTER TABLE pain_point_evidence
  ADD COLUMN IF NOT EXISTS gics_code VARCHAR(6);

-- ============================================================================
-- 3. Backfill gics_code on existing rows
-- ============================================================================

-- industry_benchmarks
UPDATE industry_benchmarks SET gics_code = '202020' WHERE industry = 'professional_services' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '451030' WHERE industry = 'saas' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '255030' WHERE industry = 'ecommerce' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '351020' WHERE industry = 'healthcare' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '402010' WHERE industry = 'finance' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '602010' WHERE industry = 'real_estate' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '403010' WHERE industry = 'insurance' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '502010' WHERE industry = 'marketing' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '201060' WHERE industry = 'manufacturing' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '255040' WHERE industry = 'retail' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '000000' WHERE industry = '_default' AND gics_code IS NULL;

-- value_calculations
UPDATE value_calculations SET gics_code = '202020' WHERE industry = 'professional_services' AND gics_code IS NULL;
UPDATE value_calculations SET gics_code = '451030' WHERE industry = 'saas' AND gics_code IS NULL;
UPDATE value_calculations SET gics_code = '255030' WHERE industry = 'ecommerce' AND gics_code IS NULL;
UPDATE value_calculations SET gics_code = '351020' WHERE industry = 'healthcare' AND gics_code IS NULL;
UPDATE value_calculations SET gics_code = '402010' WHERE industry = 'finance' AND gics_code IS NULL;
UPDATE value_calculations SET gics_code = '602010' WHERE industry = 'real_estate' AND gics_code IS NULL;
UPDATE value_calculations SET gics_code = '403010' WHERE industry = 'insurance' AND gics_code IS NULL;
UPDATE value_calculations SET gics_code = '502010' WHERE industry = 'marketing' AND gics_code IS NULL;
UPDATE value_calculations SET gics_code = '201060' WHERE industry = 'manufacturing' AND gics_code IS NULL;
UPDATE value_calculations SET gics_code = '255040' WHERE industry = 'retail' AND gics_code IS NULL;
UPDATE value_calculations SET gics_code = '000000' WHERE industry = '_default' AND gics_code IS NULL;

-- value_reports
UPDATE value_reports SET gics_code = '202020' WHERE industry = 'professional_services' AND gics_code IS NULL;
UPDATE value_reports SET gics_code = '451030' WHERE industry = 'saas' AND gics_code IS NULL;
UPDATE value_reports SET gics_code = '255030' WHERE industry = 'ecommerce' AND gics_code IS NULL;
UPDATE value_reports SET gics_code = '351020' WHERE industry = 'healthcare' AND gics_code IS NULL;
UPDATE value_reports SET gics_code = '402010' WHERE industry = 'finance' AND gics_code IS NULL;
UPDATE value_reports SET gics_code = '602010' WHERE industry = 'real_estate' AND gics_code IS NULL;
UPDATE value_reports SET gics_code = '403010' WHERE industry = 'insurance' AND gics_code IS NULL;
UPDATE value_reports SET gics_code = '502010' WHERE industry = 'marketing' AND gics_code IS NULL;
UPDATE value_reports SET gics_code = '201060' WHERE industry = 'manufacturing' AND gics_code IS NULL;
UPDATE value_reports SET gics_code = '255040' WHERE industry = 'retail' AND gics_code IS NULL;
UPDATE value_reports SET gics_code = '000000' WHERE industry = '_default' AND gics_code IS NULL;

-- pain_point_evidence
UPDATE pain_point_evidence SET gics_code = '202020' WHERE industry = 'professional_services' AND gics_code IS NULL;
UPDATE pain_point_evidence SET gics_code = '451030' WHERE industry = 'saas' AND gics_code IS NULL;
UPDATE pain_point_evidence SET gics_code = '255030' WHERE industry = 'ecommerce' AND gics_code IS NULL;
UPDATE pain_point_evidence SET gics_code = '351020' WHERE industry = 'healthcare' AND gics_code IS NULL;
UPDATE pain_point_evidence SET gics_code = '402010' WHERE industry = 'finance' AND gics_code IS NULL;
UPDATE pain_point_evidence SET gics_code = '602010' WHERE industry = 'real_estate' AND gics_code IS NULL;
UPDATE pain_point_evidence SET gics_code = '403010' WHERE industry = 'insurance' AND gics_code IS NULL;
UPDATE pain_point_evidence SET gics_code = '502010' WHERE industry = 'marketing' AND gics_code IS NULL;
UPDATE pain_point_evidence SET gics_code = '201060' WHERE industry = 'manufacturing' AND gics_code IS NULL;
UPDATE pain_point_evidence SET gics_code = '255040' WHERE industry = 'retail' AND gics_code IS NULL;
UPDATE pain_point_evidence SET gics_code = '000000' WHERE industry = '_default' AND gics_code IS NULL;

-- ============================================================================
-- 4. Indexes on gics_code
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_gics ON industry_benchmarks(gics_code);
CREATE INDEX IF NOT EXISTS idx_value_calculations_gics ON value_calculations(gics_code);
CREATE INDEX IF NOT EXISTS idx_value_reports_gics ON value_reports(gics_code);
CREATE INDEX IF NOT EXISTS idx_pain_point_evidence_gics ON pain_point_evidence(gics_code);

-- ============================================================================
-- 5. Seed industry_benchmarks for management_consulting (GICS 202020)
-- ============================================================================

INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year, notes, gics_code) VALUES
  ('management_consulting', '1-10', 'avg_hourly_wage',    65,     'BLS Management Consulting Wage Data',              2025, 'Average for junior-mid consultants in boutique firms',  '202020'),
  ('management_consulting', '11-50', 'avg_hourly_wage',   85,     'BLS Management Consulting Wage Data',              2025, 'Average for mid-senior consultants',                    '202020'),
  ('management_consulting', '1-10', 'avg_employee_cost',  110000, 'Glassdoor Management Consulting Salary Report',    2025, 'Fully loaded cost (salary + benefits + overhead)',       '202020'),
  ('management_consulting', '11-50', 'avg_employee_cost', 145000, 'Glassdoor Management Consulting Salary Report',    2025, 'Fully loaded cost',                                     '202020'),
  ('management_consulting', '1-10', 'avg_error_cost',     2000,   'Consulting Industry Quality Impact Study',         2025, 'Average cost per deliverable error or rework cycle',    '202020'),
  ('management_consulting', '11-50', 'avg_error_cost',    5000,   'Consulting Industry Quality Impact Study',         2025, 'Includes client relationship and rework costs',         '202020'),
  ('management_consulting', '1-10', 'avg_daily_revenue',  4000,   'IBISWorld Management Consulting',                  2025, 'Average daily revenue for boutique firm',               '202020'),
  ('management_consulting', '11-50', 'avg_daily_revenue', 20000,  'IBISWorld Management Consulting',                  2025, 'Average daily revenue for mid-size firm',               '202020'),
  ('management_consulting', '1-10', 'avg_deal_size',      25000,  'Kennedy Consulting Research & Advisory',           2025, 'Average engagement value for boutique firm',            '202020'),
  ('management_consulting', '11-50', 'avg_deal_size',     75000,  'Kennedy Consulting Research & Advisory',           2025, 'Average engagement value for mid-size firm',            '202020'),
  ('management_consulting', '1-10', 'avg_close_rate',     0.20,   'Consulting Sales Benchmark Report',                2025, '20% average close rate for boutique firms',             '202020'),
  ('management_consulting', '11-50', 'avg_close_rate',    0.28,   'Consulting Sales Benchmark Report',                2025, '28% close rate with established pipeline',              '202020'),
  ('management_consulting', '1-10', 'avg_lead_value',     5000,   'Consulting Lead Generation Benchmark',             2025, 'Average value of a qualified consulting lead',          '202020'),
  ('management_consulting', '11-50', 'avg_lead_value',    15000,  'Consulting Lead Generation Benchmark',             2025, 'Higher-value enterprise leads',                         '202020')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. Seed industry_benchmarks for nonprofit (GICS 900010 custom)
-- ============================================================================

INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year, notes, gics_code) VALUES
  ('nonprofit', '1-10', 'avg_hourly_wage',    22,    'BLS Nonprofit Wage Data',                          2025, 'Average for program and admin roles in small orgs',     '900010'),
  ('nonprofit', '11-50', 'avg_hourly_wage',   30,    'BLS Nonprofit Wage Data',                          2025, 'Average for mid-level nonprofit roles',                 '900010'),
  ('nonprofit', '1-10', 'avg_employee_cost',  42000, 'NonprofitHR Compensation Report',                  2025, 'Fully loaded cost (salary + benefits)',                  '900010'),
  ('nonprofit', '11-50', 'avg_employee_cost', 58000, 'NonprofitHR Compensation Report',                  2025, 'Fully loaded cost',                                     '900010'),
  ('nonprofit', '1-10', 'avg_error_cost',     1200,  'Nonprofit Compliance & Grant Error Study',         2025, 'Average cost per grant reporting or compliance error',   '900010'),
  ('nonprofit', '11-50', 'avg_error_cost',    3000,  'Nonprofit Compliance & Grant Error Study',         2025, 'Includes audit findings and funder relationship costs',  '900010'),
  ('nonprofit', '1-10', 'avg_daily_revenue',  800,   'GuideStar Nonprofit Revenue Analysis',             2025, 'Average daily revenue equivalent for small org',        '900010'),
  ('nonprofit', '11-50', 'avg_daily_revenue', 4000,  'GuideStar Nonprofit Revenue Analysis',             2025, 'Average daily revenue equivalent for mid-size org',     '900010'),
  ('nonprofit', '1-10', 'avg_deal_size',      15000, 'Foundation Center Grant Size Report',               2025, 'Average grant or major donation size',                  '900010'),
  ('nonprofit', '11-50', 'avg_deal_size',     50000, 'Foundation Center Grant Size Report',               2025, 'Average grant or major donation for mid-size org',      '900010'),
  ('nonprofit', '1-10', 'avg_close_rate',     0.15,  'Nonprofit Fundraising Benchmark Report',           2025, '15% grant application success rate',                    '900010'),
  ('nonprofit', '11-50', 'avg_close_rate',    0.20,  'Nonprofit Fundraising Benchmark Report',           2025, '20% success rate with established track record',        '900010'),
  ('nonprofit', '1-10', 'avg_lead_value',     2000,  'Nonprofit Donor Acquisition Benchmark',            2025, 'Average value of a qualified donor/funder lead',        '900010'),
  ('nonprofit', '11-50', 'avg_lead_value',    8000,  'Nonprofit Donor Acquisition Benchmark',            2025, 'Higher-value institutional funder leads',               '900010')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. Backfill gics_code on existing industry_benchmarks that predate this migration
-- ============================================================================

-- Catch any rows that might have been missed by the UPDATE statements above
UPDATE industry_benchmarks SET gics_code = '202020' WHERE industry = 'management_consulting' AND gics_code IS NULL;
UPDATE industry_benchmarks SET gics_code = '900010' WHERE industry = 'nonprofit' AND gics_code IS NULL;

-- ============================================================================
-- 8. Update pain_point_categories.industry_tags for new industries
--    management_consulting: all 10 pain points (consulting firms face all of them)
--    nonprofit: 7 of 10 (excluding scaling_bottlenecks, poor_lead_qualification, slow_response_times)
-- ============================================================================

UPDATE pain_point_categories
SET industry_tags = array_append(industry_tags, 'management_consulting')
WHERE name IN (
  'manual_processes',
  'slow_response_times',
  'inconsistent_followup',
  'scattered_tools',
  'manual_reporting',
  'poor_lead_qualification',
  'knowledge_loss',
  'scaling_bottlenecks',
  'employee_onboarding',
  'customer_churn'
)
AND NOT ('management_consulting' = ANY(industry_tags));

UPDATE pain_point_categories
SET industry_tags = array_append(industry_tags, 'nonprofit')
WHERE name IN (
  'manual_processes',
  'manual_reporting',
  'scattered_tools',
  'inconsistent_followup',
  'knowledge_loss',
  'employee_onboarding',
  'customer_churn'
)
AND NOT ('nonprofit' = ANY(industry_tags));

-- ============================================================================
-- 9. RLS policy for gics_industries (admin-only, matching other VEP tables)
-- ============================================================================

ALTER TABLE gics_industries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage GICS industries" ON gics_industries;
CREATE POLICY "Admins can manage GICS industries"
  ON gics_industries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public can read GICS industries" ON gics_industries;
CREATE POLICY "Public can read GICS industries"
  ON gics_industries FOR SELECT
  USING (true);
