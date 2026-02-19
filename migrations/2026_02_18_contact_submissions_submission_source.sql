-- ============================================================================
-- Migration: contact_submissions.submission_source for scorecard/nurture targeting
-- Date: 2026-02-18
-- Purpose: Allow tagging submissions by origin (e.g. 'scorecard', 'contact_form').
-- ============================================================================

ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS submission_source TEXT;

COMMENT ON COLUMN contact_submissions.submission_source IS 'Origin of submission for nurture targeting: scorecard, contact_form, etc.';

CREATE INDEX IF NOT EXISTS idx_contact_submissions_submission_source
  ON contact_submissions(submission_source)
  WHERE submission_source IS NOT NULL;
