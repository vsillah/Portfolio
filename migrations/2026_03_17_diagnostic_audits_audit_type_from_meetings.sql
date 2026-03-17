-- Add 'from_meetings' to diagnostic_audits.audit_type for audits built from meeting transcripts.
-- CTO-revised plan: Diagnostic audit from meeting transcripts.

ALTER TABLE diagnostic_audits
  DROP CONSTRAINT IF EXISTS diagnostic_audits_audit_type_check;

ALTER TABLE diagnostic_audits
  ADD CONSTRAINT diagnostic_audits_audit_type_check
  CHECK (audit_type IN ('chat', 'standalone', 'in_person', 'from_meetings'));

COMMENT ON COLUMN diagnostic_audits.audit_type IS 'Source of the audit: chat, standalone, in_person, or from_meetings (built from meeting transcripts)';
