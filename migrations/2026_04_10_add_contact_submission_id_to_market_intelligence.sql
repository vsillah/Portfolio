-- Add contact_submission_id to market_intelligence for single-lead social intel
ALTER TABLE market_intelligence
  ADD COLUMN IF NOT EXISTS contact_submission_id bigint
  REFERENCES contact_submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_market_intelligence_contact_submission_id
  ON market_intelligence(contact_submission_id)
  WHERE contact_submission_id IS NOT NULL;
