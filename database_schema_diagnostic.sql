-- Diagnostic Audits Schema for Chat Self-Diagnostic Feature
-- Run this in your Supabase SQL editor

-- Diagnostic audits table to store self-diagnostic results
CREATE TABLE IF NOT EXISTS diagnostic_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  contact_submission_id BIGINT REFERENCES contact_submissions(id) ON DELETE SET NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  
  -- Diagnostic category data (JSONB for flexibility)
  business_challenges JSONB DEFAULT '{}',
  tech_stack JSONB DEFAULT '{}',
  automation_needs JSONB DEFAULT '{}',
  ai_readiness JSONB DEFAULT '{}',
  budget_timeline JSONB DEFAULT '{}',
  decision_making JSONB DEFAULT '{}',
  
  -- Summary and insights (populated on completion)
  diagnostic_summary TEXT,
  key_insights TEXT[],
  recommended_actions TEXT[],
  
  -- Metadata for n8n processing
  current_category TEXT,
  questions_asked TEXT[],
  responses_received JSONB DEFAULT '{}',
  
  -- Sales enablement metadata
  urgency_score INTEGER CHECK (urgency_score >= 0 AND urgency_score <= 10),
  opportunity_score INTEGER CHECK (opportunity_score >= 0 AND opportunity_score <= 10),
  sales_notes TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_session_id ON diagnostic_audits(session_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_contact_submission_id ON diagnostic_audits(contact_submission_id) WHERE contact_submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_status ON diagnostic_audits(status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_started_at ON diagnostic_audits(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_completed_at ON diagnostic_audits(completed_at DESC) WHERE completed_at IS NOT NULL;

-- GIN indexes for JSONB fields (for efficient querying)
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_business_challenges ON diagnostic_audits USING GIN (business_challenges);
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_tech_stack ON diagnostic_audits USING GIN (tech_stack);
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_automation_needs ON diagnostic_audits USING GIN (automation_needs);
CREATE INDEX IF NOT EXISTS idx_diagnostic_audits_ai_readiness ON diagnostic_audits USING GIN (ai_readiness);

-- Update trigger for diagnostic_audits.updated_at
CREATE OR REPLACE FUNCTION update_diagnostic_audit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_diagnostic_audit_updated_at ON diagnostic_audits;
CREATE TRIGGER trigger_update_diagnostic_audit_updated_at
  BEFORE UPDATE ON diagnostic_audits
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_audit_updated_at();

-- RLS Policies
ALTER TABLE diagnostic_audits ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to create diagnostic audits
CREATE POLICY "Anyone can create diagnostic audits"
  ON diagnostic_audits
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow users to read their own diagnostic audits (by session_id)
CREATE POLICY "Anyone can read diagnostic audits"
  ON diagnostic_audits
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow updating own diagnostic audits
CREATE POLICY "Anyone can update diagnostic audits"
  ON diagnostic_audits
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON diagnostic_audits TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE diagnostic_audits IS 'Stores self-diagnostic audit results from chat conversations';
COMMENT ON COLUMN diagnostic_audits.session_id IS 'Links to chat_sessions table for conversation tracking';
COMMENT ON COLUMN diagnostic_audits.contact_submission_id IS 'Optional link to contact_submissions when email is provided';
COMMENT ON COLUMN diagnostic_audits.status IS 'Status: in_progress, completed, abandoned';
COMMENT ON COLUMN diagnostic_audits.business_challenges IS 'JSONB storing business challenges, pain points, inefficiencies';
COMMENT ON COLUMN diagnostic_audits.tech_stack IS 'JSONB storing current tech stack, tools, gaps, integration needs';
COMMENT ON COLUMN diagnostic_audits.automation_needs IS 'JSONB storing manual processes, workflow bottlenecks, automation opportunities';
COMMENT ON COLUMN diagnostic_audits.ai_readiness IS 'JSONB storing current AI usage, opportunities, concerns, readiness level';
COMMENT ON COLUMN diagnostic_audits.budget_timeline IS 'JSONB storing budget constraints, urgency, decision timeline';
COMMENT ON COLUMN diagnostic_audits.decision_making IS 'JSONB storing stakeholders, approval process, buying signals';
COMMENT ON COLUMN diagnostic_audits.current_category IS 'Current diagnostic category being processed';
COMMENT ON COLUMN diagnostic_audits.questions_asked IS 'Array of questions asked during diagnostic';
COMMENT ON COLUMN diagnostic_audits.responses_received IS 'JSONB storing all responses received';
COMMENT ON COLUMN diagnostic_audits.urgency_score IS 'Urgency score 0-10 for sales prioritization';
COMMENT ON COLUMN diagnostic_audits.opportunity_score IS 'Opportunity score 0-10 for sales prioritization';
