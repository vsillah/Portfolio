-- ============================================================================
-- Migration: Expand industry_benchmarks
-- Date: 2026-03-18
-- Purpose: Add benchmarks for missing industries (finance, real_estate,
--          insurance, marketing, manufacturing, retail) and fill gaps
--          in ecommerce and healthcare.
-- ============================================================================

-- ============================================================================
-- Fill gaps in existing industries
-- ============================================================================

-- ecommerce: missing avg_close_rate, avg_deal_size
INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year)
VALUES
  ('ecommerce', '1-10', 'avg_close_rate', 0.02, 'Shopify Commerce Report', 2025),
  ('ecommerce', '11-50', 'avg_close_rate', 0.03, 'Shopify Commerce Report', 2025),
  ('ecommerce', '1-10', 'avg_deal_size', 65, 'Statista E-commerce AOV', 2025),
  ('ecommerce', '11-50', 'avg_deal_size', 85, 'Statista E-commerce AOV', 2025)
ON CONFLICT DO NOTHING;

-- healthcare: missing avg_close_rate, avg_daily_revenue, avg_deal_size, avg_lead_value
INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year)
VALUES
  ('healthcare', '1-10', 'avg_close_rate', 0.18, 'Healthcare Marketing Report', 2025),
  ('healthcare', '11-50', 'avg_close_rate', 0.22, 'Healthcare Marketing Report', 2025),
  ('healthcare', '1-10', 'avg_daily_revenue', 2500, 'Medical Economics Practice Survey', 2025),
  ('healthcare', '11-50', 'avg_daily_revenue', 12000, 'Medical Economics Practice Survey', 2025),
  ('healthcare', '1-10', 'avg_deal_size', 8000, 'Healthcare IT Market Report', 2025),
  ('healthcare', '11-50', 'avg_deal_size', 25000, 'Healthcare IT Market Report', 2025),
  ('healthcare', '1-10', 'avg_lead_value', 1500, 'Healthcare Marketing Benchmark', 2025),
  ('healthcare', '11-50', 'avg_lead_value', 5000, 'Healthcare Marketing Benchmark', 2025)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- New industries: finance
-- ============================================================================
INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year)
VALUES
  ('finance', '1-10', 'avg_hourly_wage', 55, 'BLS Financial Activities Wage Data', 2025),
  ('finance', '11-50', 'avg_hourly_wage', 70, 'BLS Financial Activities Wage Data', 2025),
  ('finance', '1-10', 'avg_employee_cost', 95000, 'Glassdoor Finance Salary Report', 2025),
  ('finance', '11-50', 'avg_employee_cost', 120000, 'Glassdoor Finance Salary Report', 2025),
  ('finance', '1-10', 'avg_deal_size', 15000, 'Financial Services Sales Benchmark', 2025),
  ('finance', '11-50', 'avg_deal_size', 50000, 'Financial Services Sales Benchmark', 2025),
  ('finance', '1-10', 'avg_close_rate', 0.20, 'Financial Services Sales Benchmark', 2025),
  ('finance', '11-50', 'avg_close_rate', 0.25, 'Financial Services Sales Benchmark', 2025),
  ('finance', '1-10', 'avg_daily_revenue', 3000, 'IBISWorld Financial Services', 2025),
  ('finance', '11-50', 'avg_daily_revenue', 15000, 'IBISWorld Financial Services', 2025),
  ('finance', '1-10', 'avg_error_cost', 2500, 'Ponemon Institute Financial Error Study', 2025),
  ('finance', '11-50', 'avg_error_cost', 5000, 'Ponemon Institute Financial Error Study', 2025),
  ('finance', '1-10', 'avg_lead_value', 3000, 'Financial Advisor Marketing Report', 2025),
  ('finance', '11-50', 'avg_lead_value', 8000, 'Financial Advisor Marketing Report', 2025)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- New industries: real_estate
-- ============================================================================
INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year)
VALUES
  ('real_estate', '1-10', 'avg_hourly_wage', 35, 'BLS Real Estate Wage Data', 2025),
  ('real_estate', '11-50', 'avg_hourly_wage', 50, 'BLS Real Estate Wage Data', 2025),
  ('real_estate', '1-10', 'avg_employee_cost', 60000, 'NAR Member Profile', 2025),
  ('real_estate', '11-50', 'avg_employee_cost', 80000, 'NAR Member Profile', 2025),
  ('real_estate', '1-10', 'avg_deal_size', 8500, 'NAR Commission Benchmark', 2025),
  ('real_estate', '11-50', 'avg_deal_size', 12000, 'NAR Commission Benchmark', 2025),
  ('real_estate', '1-10', 'avg_close_rate', 0.03, 'Real Estate Lead Conversion Study', 2025),
  ('real_estate', '11-50', 'avg_close_rate', 0.05, 'Real Estate Lead Conversion Study', 2025),
  ('real_estate', '1-10', 'avg_daily_revenue', 1200, 'IBISWorld Real Estate Brokerage', 2025),
  ('real_estate', '11-50', 'avg_daily_revenue', 5500, 'IBISWorld Real Estate Brokerage', 2025),
  ('real_estate', '1-10', 'avg_error_cost', 800, 'Real Estate Transaction Error Report', 2025),
  ('real_estate', '11-50', 'avg_error_cost', 2000, 'Real Estate Transaction Error Report', 2025),
  ('real_estate', '1-10', 'avg_lead_value', 250, 'Zillow Agent Lead Value Study', 2025),
  ('real_estate', '11-50', 'avg_lead_value', 600, 'Zillow Agent Lead Value Study', 2025)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- New industries: insurance
-- ============================================================================
INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year)
VALUES
  ('insurance', '1-10', 'avg_hourly_wage', 40, 'BLS Insurance Wage Data', 2025),
  ('insurance', '11-50', 'avg_hourly_wage', 55, 'BLS Insurance Wage Data', 2025),
  ('insurance', '1-10', 'avg_employee_cost', 70000, 'Insurance Journal Salary Survey', 2025),
  ('insurance', '11-50', 'avg_employee_cost', 95000, 'Insurance Journal Salary Survey', 2025),
  ('insurance', '1-10', 'avg_deal_size', 2500, 'Insurance Industry Sales Benchmark', 2025),
  ('insurance', '11-50', 'avg_deal_size', 8000, 'Insurance Industry Sales Benchmark', 2025),
  ('insurance', '1-10', 'avg_close_rate', 0.12, 'Insurance Sales Conversion Report', 2025),
  ('insurance', '11-50', 'avg_close_rate', 0.18, 'Insurance Sales Conversion Report', 2025),
  ('insurance', '1-10', 'avg_daily_revenue', 1500, 'IBISWorld Insurance Agencies', 2025),
  ('insurance', '11-50', 'avg_daily_revenue', 8000, 'IBISWorld Insurance Agencies', 2025),
  ('insurance', '1-10', 'avg_error_cost', 1500, 'Insurance Claims Error Study', 2025),
  ('insurance', '11-50', 'avg_error_cost', 3500, 'Insurance Claims Error Study', 2025),
  ('insurance', '1-10', 'avg_lead_value', 500, 'Insurance Lead Generation Report', 2025),
  ('insurance', '11-50', 'avg_lead_value', 1500, 'Insurance Lead Generation Report', 2025)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- New industries: marketing (marketing_agency)
-- ============================================================================
INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year)
VALUES
  ('marketing', '1-10', 'avg_hourly_wage', 45, 'BLS Marketing Wage Data', 2025),
  ('marketing', '11-50', 'avg_hourly_wage', 60, 'BLS Marketing Wage Data', 2025),
  ('marketing', '1-10', 'avg_employee_cost', 75000, 'Agency Management Institute Survey', 2025),
  ('marketing', '11-50', 'avg_employee_cost', 95000, 'Agency Management Institute Survey', 2025),
  ('marketing', '1-10', 'avg_deal_size', 5000, 'HubSpot Agency Pricing Report', 2025),
  ('marketing', '11-50', 'avg_deal_size', 15000, 'HubSpot Agency Pricing Report', 2025),
  ('marketing', '1-10', 'avg_close_rate', 0.22, 'Agency New Business Benchmark', 2025),
  ('marketing', '11-50', 'avg_close_rate', 0.28, 'Agency New Business Benchmark', 2025),
  ('marketing', '1-10', 'avg_daily_revenue', 1800, 'IBISWorld Marketing Agencies', 2025),
  ('marketing', '11-50', 'avg_daily_revenue', 8500, 'IBISWorld Marketing Agencies', 2025),
  ('marketing', '1-10', 'avg_error_cost', 600, 'Marketing Campaign Error Impact Study', 2025),
  ('marketing', '11-50', 'avg_error_cost', 1500, 'Marketing Campaign Error Impact Study', 2025),
  ('marketing', '1-10', 'avg_lead_value', 1200, 'Agency Lead Value Benchmark', 2025),
  ('marketing', '11-50', 'avg_lead_value', 3500, 'Agency Lead Value Benchmark', 2025)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- New industries: manufacturing
-- ============================================================================
INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year)
VALUES
  ('manufacturing', '1-10', 'avg_hourly_wage', 30, 'BLS Manufacturing Wage Data', 2025),
  ('manufacturing', '11-50', 'avg_hourly_wage', 40, 'BLS Manufacturing Wage Data', 2025),
  ('manufacturing', '1-10', 'avg_employee_cost', 55000, 'Manufacturing Institute Salary Report', 2025),
  ('manufacturing', '11-50', 'avg_employee_cost', 72000, 'Manufacturing Institute Salary Report', 2025),
  ('manufacturing', '1-10', 'avg_deal_size', 25000, 'Manufacturing Sales Benchmark', 2025),
  ('manufacturing', '11-50', 'avg_deal_size', 75000, 'Manufacturing Sales Benchmark', 2025),
  ('manufacturing', '1-10', 'avg_close_rate', 0.15, 'Industrial Sales Conversion Report', 2025),
  ('manufacturing', '11-50', 'avg_close_rate', 0.20, 'Industrial Sales Conversion Report', 2025),
  ('manufacturing', '1-10', 'avg_daily_revenue', 5000, 'IBISWorld Manufacturing', 2025),
  ('manufacturing', '11-50', 'avg_daily_revenue', 25000, 'IBISWorld Manufacturing', 2025),
  ('manufacturing', '1-10', 'avg_error_cost', 3000, 'ASQ Cost of Quality Report', 2025),
  ('manufacturing', '11-50', 'avg_error_cost', 8000, 'ASQ Cost of Quality Report', 2025),
  ('manufacturing', '1-10', 'avg_lead_value', 5000, 'Industrial Marketing Benchmark', 2025),
  ('manufacturing', '11-50', 'avg_lead_value', 15000, 'Industrial Marketing Benchmark', 2025)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- New industries: retail
-- ============================================================================
INSERT INTO industry_benchmarks (industry, company_size_range, benchmark_type, value, source, year)
VALUES
  ('retail', '1-10', 'avg_hourly_wage', 18, 'BLS Retail Trade Wage Data', 2025),
  ('retail', '11-50', 'avg_hourly_wage', 25, 'BLS Retail Trade Wage Data', 2025),
  ('retail', '1-10', 'avg_employee_cost', 35000, 'NRF Retail Compensation Report', 2025),
  ('retail', '11-50', 'avg_employee_cost', 48000, 'NRF Retail Compensation Report', 2025),
  ('retail', '1-10', 'avg_deal_size', 45, 'NRF Average Transaction Value', 2025),
  ('retail', '11-50', 'avg_deal_size', 65, 'NRF Average Transaction Value', 2025),
  ('retail', '1-10', 'avg_close_rate', 0.03, 'Retail Conversion Rate Benchmark', 2025),
  ('retail', '11-50', 'avg_close_rate', 0.05, 'Retail Conversion Rate Benchmark', 2025),
  ('retail', '1-10', 'avg_daily_revenue', 2000, 'IBISWorld Retail Trade', 2025),
  ('retail', '11-50', 'avg_daily_revenue', 10000, 'IBISWorld Retail Trade', 2025),
  ('retail', '1-10', 'avg_error_cost', 200, 'NRF Shrinkage and Error Report', 2025),
  ('retail', '11-50', 'avg_error_cost', 500, 'NRF Shrinkage and Error Report', 2025),
  ('retail', '1-10', 'avg_lead_value', 100, 'Retail Customer Acquisition Report', 2025),
  ('retail', '11-50', 'avg_lead_value', 300, 'Retail Customer Acquisition Report', 2025)
ON CONFLICT DO NOTHING;
