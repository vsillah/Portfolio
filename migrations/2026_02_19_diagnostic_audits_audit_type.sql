-- diagnostic_audits.audit_type: NOT NULL column for audit source (chat, standalone, in_person).
-- Required when inserting rows; defaults to 'chat' for backward compatibility.
-- Apply after 2026_02_10_diagnostic_audits_session_id.sql (or any migration that creates diagnostic_audits).

ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS audit_type TEXT NOT NULL DEFAULT 'chat';

COMMENT ON COLUMN diagnostic_audits.audit_type IS 'Source of the audit: chat (conversation), standalone (form tool), in_person (sales conversation)';

-- Optional: restrict to known values (skip if your DB already has a different check).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'diagnostic_audits_audit_type_check'
  ) THEN
    ALTER TABLE diagnostic_audits
      ADD CONSTRAINT diagnostic_audits_audit_type_check
      CHECK (audit_type IN ('chat', 'standalone', 'in_person'));
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;
