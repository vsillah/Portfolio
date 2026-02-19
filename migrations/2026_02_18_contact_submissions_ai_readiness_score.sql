-- ============================================================================
-- Migration: contact_submissions.ai_readiness_score for scorecard (0-10)
-- Date: 2026-02-18
-- Purpose: Store AI Readiness Score from scorecard form; used by Lead Pipeline and n8n.
-- ============================================================================

ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS ai_readiness_score INTEGER;

COMMENT ON COLUMN contact_submissions.ai_readiness_score IS 'AI Readiness Score 0-10 from scorecard form or Research Agent.';

CREATE INDEX IF NOT EXISTS idx_contact_submissions_ai_readiness_score
  ON contact_submissions(ai_readiness_score)
  WHERE ai_readiness_score IS NOT NULL;
