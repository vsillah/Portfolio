-- Re-add warm_facebook_groups for n8n WF-WRM and E2E ingest payloads.
-- Removed earlier by 2026_02_11_add_manual_lead_sources.sql but still emitted by scrapers.

ALTER TABLE contact_submissions
DROP CONSTRAINT IF EXISTS contact_submissions_lead_source_check;

ALTER TABLE contact_submissions
ADD CONSTRAINT contact_submissions_lead_source_check
CHECK (
  lead_source IN (
    'warm_facebook_friends',
    'warm_facebook_groups',
    'warm_google_contacts',
    'warm_linkedin',
    'warm_referral',
    'cold_apollo',
    'cold_hunter',
    'cold_referral',
    'cold_linkedin',
    'cold_business_card',
    'cold_event',
    'website_form',
    'other'
  )
);
