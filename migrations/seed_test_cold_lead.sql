-- ============================================================================
-- Seed: Create a manual test cold lead to validate the pipeline
-- This bypasses Apollo.io and lets you test the enrichment + outreach flow
-- ============================================================================

-- Insert a test cold lead (you can use a fake/test contact)
INSERT INTO contact_submissions (
  name,
  email,
  company,
  company_domain,
  linkedin_url,
  job_title,
  industry,
  employee_count,
  location,
  lead_source,
  outreach_status,
  qualification_status,
  message
) VALUES (
  'Test McTesterson',
  'test@example-saas-company.com',
  'Example SaaS Inc',
  'example-saas.com',
  'https://www.linkedin.com/in/testmctesterson',
  'CTO',
  'Software',
  '50',
  'San Francisco, CA, USA',
  'cold_referral',
  'not_contacted',
  'pending',
  'Manual test lead to validate pipeline'
)
ON CONFLICT DO NOTHING
RETURNING id, name, email, company;

-- Now trigger the Lead Research webhook manually with this lead
-- Copy the ID from the result above and use it in the next step
