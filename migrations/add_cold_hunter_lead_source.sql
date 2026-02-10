-- Add 'cold_hunter' to the lead_source check constraint

-- Step 1: Check what lead_source values currently exist (for debugging)
-- Uncomment to see all current values:
-- SELECT DISTINCT lead_source, COUNT(*) FROM contact_submissions GROUP BY lead_source ORDER BY lead_source;

-- Step 2: Drop the existing constraint FIRST (before updating rows)
ALTER TABLE contact_submissions 
DROP CONSTRAINT IF EXISTS contact_submissions_lead_source_check;

-- Step 3: Update any NULL or invalid lead_source values to 'other'
-- This includes 'warm_facebook_engagement' and any other non-standard values
UPDATE contact_submissions 
SET lead_source = 'warm_facebook_friends'
WHERE lead_source = 'warm_facebook_engagement';

UPDATE contact_submissions 
SET lead_source = 'other' 
WHERE lead_source IS NULL 
   OR lead_source NOT IN (
    'warm_facebook_friends',
    'warm_google_contacts',
    'warm_linkedin',
    'cold_apollo',
    'cold_hunter',
    'cold_referral',
    'warm_referral',
    'website_form',
    'other'
  );

-- Step 4: Now recreate the constraint with 'cold_hunter' included
ALTER TABLE contact_submissions
ADD CONSTRAINT contact_submissions_lead_source_check 
CHECK (
  lead_source IN (
    'warm_facebook_friends',
    'warm_google_contacts',
    'warm_linkedin',
    'cold_apollo',
    'cold_hunter',  -- NEW: Hunter.io sourced leads
    'cold_referral',
    'warm_referral',
    'website_form',
    'other'
  )
);

-- Verify the constraint was added successfully
SELECT conname, convalidated 
FROM pg_constraint 
WHERE conname = 'contact_submissions_lead_source_check';
