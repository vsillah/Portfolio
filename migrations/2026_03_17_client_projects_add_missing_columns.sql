-- Add missing columns to client_projects that are referenced throughout the codebase.
-- These columns were assumed to exist by multiple API routes, lib functions, and the
-- client dashboard but were never added to the table schema.

ALTER TABLE client_projects
  ADD COLUMN IF NOT EXISTS client_company TEXT,
  ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES proposals(id),
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS sales_session_id UUID REFERENCES sales_sessions(id),
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- Index on proposal_id for the join used in milestones, dashboard docs, etc.
CREATE INDEX IF NOT EXISTS idx_client_projects_proposal_id
  ON client_projects (proposal_id)
  WHERE proposal_id IS NOT NULL;
