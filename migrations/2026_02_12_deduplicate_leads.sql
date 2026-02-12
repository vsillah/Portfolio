-- ============================================================================
-- Migration: Deduplicate contact_submissions and add unique constraints
-- Date: 2026-02-12
-- Problem: 7,503 rows with only ~231 distinct leads (97% duplication)
-- Root causes:
--   1. WF-CLG-001 had dedupe disabled, wrote directly to Supabase
--   2. WF-WRM-002 sent name-only leads with no dedupe fields
--   3. Contact form had no dedupe logic
--   4. No DB-level unique constraints
-- ============================================================================

BEGIN;

-- Step 1: Create a temp table mapping each row to its canonical (oldest) ID
-- For leads WITH email: group by lower(email)
-- For leads WITHOUT email: group by lower(name) + lead_source + lower(company)
CREATE TEMP TABLE lead_canonical AS
WITH email_groups AS (
  SELECT
    id,
    MIN(id) OVER (PARTITION BY lower(email)) AS canonical_id
  FROM contact_submissions
  WHERE email IS NOT NULL AND email != ''
),
name_groups AS (
  SELECT
    id,
    MIN(id) OVER (
      PARTITION BY lower(name), COALESCE(lead_source, ''), COALESCE(lower(company), '')
    ) AS canonical_id
  FROM contact_submissions
  WHERE email IS NULL OR email = ''
)
SELECT id, canonical_id FROM email_groups
UNION ALL
SELECT id, canonical_id FROM name_groups;

-- Step 2: Identify duplicate IDs (rows that are NOT the canonical)
CREATE TEMP TABLE duplicate_ids AS
SELECT DISTINCT id, canonical_id
FROM lead_canonical
WHERE id != canonical_id;

-- Log the scale of cleanup
DO $$
DECLARE
  dupe_count INT;
BEGIN
  SELECT COUNT(*) INTO dupe_count FROM duplicate_ids;
  RAISE NOTICE 'Deduplication: % duplicate rows identified for removal', dupe_count;
END $$;

-- Step 3: Reassign FK references from duplicates to their canonical IDs
-- Only sales_sessions has 3 rows referencing duplicates (checked pre-migration)

UPDATE sales_sessions ss
SET contact_submission_id = d.canonical_id
FROM duplicate_ids d
WHERE ss.contact_submission_id = d.id;

UPDATE outreach_queue oq
SET contact_submission_id = d.canonical_id
FROM duplicate_ids d
WHERE oq.contact_submission_id = d.id;

UPDATE pain_point_evidence pe
SET contact_submission_id = d.canonical_id
FROM duplicate_ids d
WHERE pe.contact_submission_id = d.id;

UPDATE client_projects cp
SET contact_submission_id = d.canonical_id
FROM duplicate_ids d
WHERE cp.contact_submission_id = d.id;

UPDATE value_reports vr
SET contact_submission_id = d.canonical_id
FROM duplicate_ids d
WHERE vr.contact_submission_id = d.id;

UPDATE lead_magnet_downloads lmd
SET contact_submission_id = d.canonical_id
FROM duplicate_ids d
WHERE lmd.contact_submission_id = d.id;

-- Also update diagnostic_audits (no FK constraint but has the column)
UPDATE diagnostic_audits da
SET contact_submission_id = d.canonical_id
FROM duplicate_ids d
WHERE da.contact_submission_id = d.id;

-- Step 4: Delete duplicate rows
DELETE FROM contact_submissions
WHERE id IN (SELECT id FROM duplicate_ids);

-- Step 5: Add partial unique index on lower(email) to prevent future email duplicates
-- Partial: only applies where email IS NOT NULL (allows multiple NULL emails)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_submissions_email_unique
ON contact_submissions (lower(email))
WHERE email IS NOT NULL AND email != '';

-- Step 6: Add a partial unique index for name-only leads (same name + source + company)
-- This prevents the same Google Contact or similar from being re-imported
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_submissions_name_source_unique
ON contact_submissions (lower(name), COALESCE(lead_source, ''), COALESCE(lower(company), ''))
WHERE email IS NULL OR email = '';

-- Clean up temp tables
DROP TABLE IF EXISTS duplicate_ids;
DROP TABLE IF EXISTS lead_canonical;

COMMIT;
