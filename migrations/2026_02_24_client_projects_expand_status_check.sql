-- Expand client_projects project_status CHECK constraint to include
-- payment_received, onboarding_scheduled, onboarding_completed statuses
-- used by WF-001 (Client Payment Intake) and WF-001B (Onboarding Call Handler).

ALTER TABLE client_projects DROP CONSTRAINT IF EXISTS client_projects_project_status_check;
ALTER TABLE client_projects ADD CONSTRAINT client_projects_project_status_check
  CHECK (project_status IN (
    'active',
    'paused',
    'testing',
    'delivering',
    'complete',
    'payment_received',
    'onboarding_scheduled',
    'onboarding_completed'
  ));
