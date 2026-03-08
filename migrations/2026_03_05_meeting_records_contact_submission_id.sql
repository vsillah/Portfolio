-- Link meeting_records to leads (contact_submissions) so discovery meetings
-- are traceable before a client_project exists.
-- contact_submissions.id is bigint; this matches the FK type used by
-- sales_sessions.contact_submission_id and client_projects.contact_submission_id.

ALTER TABLE meeting_records
  ADD COLUMN IF NOT EXISTS contact_submission_id bigint
    REFERENCES contact_submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_records_contact_submission
  ON meeting_records(contact_submission_id)
  WHERE contact_submission_id IS NOT NULL;
