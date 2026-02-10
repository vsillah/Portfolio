-- ============================================================================
-- Migration: Make email optional in contact_submissions
-- Date: 2026-02-09
-- Reason: Allow warm leads from Facebook/LinkedIn without email addresses
-- ============================================================================

-- Make email nullable to support warm leads without email addresses
ALTER TABLE contact_submissions 
ALTER COLUMN email DROP NOT NULL;

-- Update index to handle NULL values (partial index excludes NULLs for better performance)
DROP INDEX IF EXISTS idx_contact_submissions_email;
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email 
ON contact_submissions(email) 
WHERE email IS NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN contact_submissions.email IS 'Email address (optional for warm leads from social networks). Required for cold outreach campaigns.';
