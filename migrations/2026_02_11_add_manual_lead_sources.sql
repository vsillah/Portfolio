-- Add manual-entry lead source values to the check constraint
-- Supports: cold_linkedin, cold_business_card, cold_event (from Add Lead form)

-- Step 1: Drop the existing constraint
ALTER TABLE contact_submissions
DROP CONSTRAINT IF EXISTS contact_submissions_lead_source_check;

-- Step 2: Recreate with the expanded set
ALTER TABLE contact_submissions
ADD CONSTRAINT contact_submissions_lead_source_check
CHECK (
  lead_source IN (
    'warm_facebook_friends',
    'warm_google_contacts',
    'warm_linkedin',
    'warm_referral',
    'cold_apollo',
    'cold_hunter',
    'cold_referral',
    'cold_linkedin',       -- NEW: manual entry via LinkedIn
    'cold_business_card',  -- NEW: manual entry via business card
    'cold_event',          -- NEW: manual entry via event/conference
    'website_form',
    'other'
  )
);

-- Verify
SELECT conname, convalidated
FROM pg_constraint
WHERE conname = 'contact_submissions_lead_source_check';
