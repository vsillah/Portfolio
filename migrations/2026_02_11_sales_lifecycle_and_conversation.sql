-- Sales lifecycle and conversation-without-audit support
-- 1. sales_sessions: link to lead (contact_submission_id) and client (client_project_id)
-- 2. diagnostic_audits: link in-person audits to sales_session; session_id already nullable in 2026_02_10
-- 3. contact_submissions: add outreach_status 'in_conversation' when rep is in a live conversation

-- =============================================================================
-- 1. sales_sessions: contact_submission_id, client_project_id
-- =============================================================================
ALTER TABLE sales_sessions
  ADD COLUMN IF NOT EXISTS contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_project_id UUID REFERENCES client_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_sessions_contact_submission_id
  ON sales_sessions(contact_submission_id) WHERE contact_submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_sessions_client_project_id
  ON sales_sessions(client_project_id) WHERE client_project_id IS NOT NULL;

COMMENT ON COLUMN sales_sessions.contact_submission_id IS 'Originating lead when session started from outreach/leads';
COMMENT ON COLUMN sales_sessions.client_project_id IS 'Resulting client when deal converted; set when client_project created from proposal';

-- =============================================================================
-- 2. diagnostic_audits: sales_session_id for in-person diagnostics
-- =============================================================================
ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS sales_session_id UUID REFERENCES sales_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_sales_session_id
  ON diagnostic_audits(sales_session_id) WHERE sales_session_id IS NOT NULL;

COMMENT ON COLUMN diagnostic_audits.sales_session_id IS 'Set when audit was created via in-person diagnostic in a sales conversation';

-- Ensure session_id is nullable (in case original schema had NOT NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_audits' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE diagnostic_audits ALTER COLUMN session_id DROP NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL; -- ignore if already nullable or no column
END $$;

-- =============================================================================
-- 3. contact_submissions: add 'in_conversation' to outreach_status
-- =============================================================================
ALTER TABLE contact_submissions DROP CONSTRAINT IF EXISTS contact_submissions_outreach_status_check;
ALTER TABLE contact_submissions ADD CONSTRAINT contact_submissions_outreach_status_check
  CHECK (outreach_status IN (
    'not_contacted',
    'sequence_active',
    'replied',
    'booked',
    'opted_out',
    'no_response',
    'in_conversation'
  ));

COMMENT ON COLUMN contact_submissions.outreach_status IS 'Cold outreach funnel; in_conversation = rep has active sales conversation, pause sequence';
