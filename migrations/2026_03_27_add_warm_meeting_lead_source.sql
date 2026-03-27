-- Add warm_meeting lead_source for leads created from meeting transcripts.
-- Prerequisite for the meeting-to-lead pipeline (Phase 2a).

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
    'warm_meeting',
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
