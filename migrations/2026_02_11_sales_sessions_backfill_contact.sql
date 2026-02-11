-- Backfill contact_submission_id on sales_sessions from linked diagnostic_audits
-- Run after 2026_02_11_sales_lifecycle_and_conversation.sql

UPDATE sales_sessions ss
SET contact_submission_id = da.contact_submission_id
FROM diagnostic_audits da
WHERE ss.diagnostic_audit_id = da.id
  AND ss.contact_submission_id IS NULL
  AND da.contact_submission_id IS NOT NULL;
