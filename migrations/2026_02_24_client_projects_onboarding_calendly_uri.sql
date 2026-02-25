-- Add onboarding_calendly_uri to client_projects for WF-001B Onboarding Call Handler.
-- Stores the Calendly event URI when an onboarding call is booked.

ALTER TABLE client_projects
  ADD COLUMN IF NOT EXISTS onboarding_calendly_uri TEXT;

COMMENT ON COLUMN client_projects.onboarding_calendly_uri IS 'Calendly event URI when onboarding call was booked (set by n8n WF-001B).';
