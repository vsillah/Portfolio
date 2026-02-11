-- Value evidence pipeline: push tracking and rep pain points on contact_submissions
-- Run after value_evidence_pipeline.sql and cold lead pipeline migrations.

ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS last_vep_triggered_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS last_vep_status TEXT DEFAULT NULL;

ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS rep_pain_points TEXT DEFAULT NULL;

-- Constrain status to known values (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contact_submissions_last_vep_status_check'
  ) THEN
    ALTER TABLE contact_submissions
    ADD CONSTRAINT contact_submissions_last_vep_status_check
    CHECK (last_vep_status IS NULL OR last_vep_status IN ('pending', 'success', 'failed'));
  END IF;
END $$;

COMMENT ON COLUMN contact_submissions.last_vep_triggered_at IS 'Set when extract-leads is called for this contact';
COMMENT ON COLUMN contact_submissions.last_vep_status IS 'pending on trigger; success when ingest callback runs; failed for manual/timeout';
COMMENT ON COLUMN contact_submissions.rep_pain_points IS 'Free-text pain points from sales rep (Add Lead form or Review & Enrich modal)';
