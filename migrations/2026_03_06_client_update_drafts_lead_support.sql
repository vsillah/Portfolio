-- Support lead-based follow-up drafts alongside client project updates.
-- client_project_id becomes nullable so drafts can target leads who haven't
-- converted yet. contact_submission_id links to the lead. draft_type
-- distinguishes the two audiences.

ALTER TABLE client_update_drafts
  ALTER COLUMN client_project_id DROP NOT NULL;

ALTER TABLE client_update_drafts
  ADD COLUMN IF NOT EXISTS contact_submission_id bigint
    REFERENCES contact_submissions(id) ON DELETE SET NULL;

ALTER TABLE client_update_drafts
  ADD COLUMN IF NOT EXISTS draft_type text NOT NULL DEFAULT 'client_update';

-- Ensure at least one audience target is set
ALTER TABLE client_update_drafts
  ADD CONSTRAINT chk_draft_audience
    CHECK (client_project_id IS NOT NULL OR contact_submission_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_client_update_drafts_contact_submission
  ON client_update_drafts(contact_submission_id)
  WHERE contact_submission_id IS NOT NULL;
