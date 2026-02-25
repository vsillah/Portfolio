-- Seed a client_projects row for WF-002 Kickoff Call Scheduled testing.
-- Run in Supabase Dashboard → SQL Editor.
-- Prereq: project_status CHECK must include 'onboarding_completed' and 'kickoff_scheduled'
--   (see migrations/2026_02_24_client_projects_expand_status_check.sql and
--    migrations/2026_02_25_client_projects_kickoff_scheduled_status.sql).
-- Then run: ./scripts/trigger-kickoff-call-booked-webhook.sh

INSERT INTO client_projects (
  client_name,
  client_email,
  project_status,
  project_name,
  project_start_date,
  estimated_end_date
) VALUES (
  'Test Kickoff Caller',
  'test-kickoff@example.com',
  'onboarding_completed',
  'Test Kickoff Project',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '90 days'
);
