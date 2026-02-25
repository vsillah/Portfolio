-- Add kickoff_scheduled to client_projects project_status CHECK (used by WF-002).

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
    'onboarding_completed',
    'kickoff_scheduled'
  ));
