-- Add ALL potentially missing columns to diagnostic_audits
-- The table may have been created from an older/partial schema.
-- Each ADD COLUMN IF NOT EXISTS is safe to re-run.

ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_submission_id BIGINT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS business_challenges JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tech_stack JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS automation_needs JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_readiness JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS budget_timeline JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decision_making JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS diagnostic_summary TEXT,
  ADD COLUMN IF NOT EXISTS key_insights TEXT[],
  ADD COLUMN IF NOT EXISTS recommended_actions TEXT[],
  ADD COLUMN IF NOT EXISTS current_category TEXT,
  ADD COLUMN IF NOT EXISTS questions_asked TEXT[],
  ADD COLUMN IF NOT EXISTS responses_received JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS urgency_score INTEGER,
  ADD COLUMN IF NOT EXISTS opportunity_score INTEGER,
  ADD COLUMN IF NOT EXISTS sales_notes TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes (IF NOT EXISTS is safe to re-run)
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_session_id ON diagnostic_audits(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_contact_submission_id ON diagnostic_audits(contact_submission_id) WHERE contact_submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_status ON diagnostic_audits(status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_started_at ON diagnostic_audits(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_completed_at ON diagnostic_audits(completed_at DESC) WHERE completed_at IS NOT NULL;
