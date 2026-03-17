-- Store BuiltWith tech stack per contact (once per client); propagated to diagnostic_audits.
ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS website_tech_stack JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_tech_stack_fetched_at TIMESTAMPTZ;

COMMENT ON COLUMN contact_submissions.website_tech_stack IS 'BuiltWith API result: { domain, technologies?, byTag? }. Fetched once per client and propagated to all their diagnostic audits.';
COMMENT ON COLUMN contact_submissions.website_tech_stack_fetched_at IS 'When website_tech_stack was last fetched for this contact.';
