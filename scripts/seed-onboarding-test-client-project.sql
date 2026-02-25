-- Seed a client_projects row for WF-001B Onboarding Call Handler testing.
-- Run in Supabase Dashboard → SQL Editor.
-- Then run: ./scripts/trigger-onboarding-call-booked-webhook.sh

INSERT INTO client_projects (
  client_name,
  client_email,
  project_status,
  project_name,
  project_start_date,
  estimated_end_date
) VALUES (
  'Test Onboarding Caller',
  'test-onboarding@example.com',
  'active',
  'Test Onboarding Project',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '90 days'
);
