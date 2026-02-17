-- Do Not Contact and soft-remove for leads (outreach pipeline).
-- do_not_contact: admin-marked; ingest must not overwrite these when re-pushing from n8n.
-- removed_at: admin "removed" lead; hide from default list and exclude from outreach.

ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

COMMENT ON COLUMN contact_submissions.do_not_contact IS 'If true, do not use for outreach and skip on re-ingest from n8n.';
COMMENT ON COLUMN contact_submissions.removed_at IS 'When set, lead is removed from active list; admin can restore by clearing.';

CREATE INDEX IF NOT EXISTS idx_contact_submissions_do_not_contact
  ON contact_submissions(do_not_contact) WHERE do_not_contact = true;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_removed_at
  ON contact_submissions(removed_at) WHERE removed_at IS NOT NULL;
