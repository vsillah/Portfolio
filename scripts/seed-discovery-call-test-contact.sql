-- Seed contact_submissions row for WF-000A Discovery Call Booked testing.
-- Run in Supabase Dashboard → SQL Editor.
-- Then run: ./scripts/trigger-discovery-call-booked-webhook.sh

INSERT INTO contact_submissions (
  name,
  email,
  company,
  lead_source
) VALUES (
  'Test Discovery Caller',
  'test-discovery@example.com',
  'Test Co',
  'website_form'
)
ON CONFLICT (lower(email)) WHERE (email IS NOT NULL AND email != '')
DO UPDATE SET
  name = EXCLUDED.name,
  company = EXCLUDED.company,
  lead_source = EXCLUDED.lead_source,
  updated_at = NOW();
