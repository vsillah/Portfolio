-- Seed contact_submissions row id=99999 for Lead Qualification webhook testing.
-- Run in Supabase Dashboard → SQL Editor if the TS script fails (e.g. RLS/insert restrictions).
-- Then run: ./scripts/trigger-lead-qualification-webhook.sh

INSERT INTO contact_submissions (
  id,
  name,
  email,
  company,
  company_domain,
  linkedin_url,
  annual_revenue,
  interest_summary,
  message,
  is_decision_maker,
  lead_source
) VALUES (
  99999,
  'Test User',
  'test-lead-qual-99999@example.com',
  'Test Co',
  'test.com',
  'https://linkedin.com/in/test',
  '100k_500k',
  'AI adoption, process automation, lead qualification',
  'Interested in exploring AI automation for our sales team.',
  true,
  'website_form'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  company = EXCLUDED.company,
  company_domain = EXCLUDED.company_domain,
  linkedin_url = EXCLUDED.linkedin_url,
  annual_revenue = EXCLUDED.annual_revenue,
  interest_summary = EXCLUDED.interest_summary,
  message = EXCLUDED.message,
  is_decision_maker = EXCLUDED.is_decision_maker,
  lead_source = EXCLUDED.lead_source,
  updated_at = NOW();
