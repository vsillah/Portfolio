-- ============================================================================
-- Seed: Create a test cold lead source for pipeline validation
-- Run this after applying the cold_lead_pipeline migration
-- ============================================================================

-- Create a test lead source for SaaS Founders (small batch for testing)
INSERT INTO cold_lead_sources (
  name,
  description,
  platform,
  search_criteria,
  is_active,
  max_leads_per_run,
  run_frequency
) VALUES (
  'Test Source - SaaS Founders',
  'Small test batch to validate the cold lead pipeline end-to-end',
  'apollo',
  '{
    "person_titles": ["Founder", "CEO", "Co-Founder"],
    "organization_num_employees_ranges": ["1,10", "11,50"],
    "person_locations": ["United States"],
    "q_organization_keyword_tags": ["5567cd4773696439b10b0000"]
  }'::jsonb,
  true,
  5,
  'manual'
)
ON CONFLICT DO NOTHING;

-- Verify the insert
SELECT 
  id,
  name,
  platform,
  is_active,
  max_leads_per_run,
  created_at
FROM cold_lead_sources
WHERE name = 'Test Source - SaaS Founders';
