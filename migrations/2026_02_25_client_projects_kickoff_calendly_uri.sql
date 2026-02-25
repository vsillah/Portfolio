-- Add kickoff_calendly_uri column to client_projects (used by WF-002).

ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS kickoff_calendly_uri TEXT;
