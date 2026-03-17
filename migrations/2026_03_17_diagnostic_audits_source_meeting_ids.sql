-- Store meeting_records.id used to build an audit (audit_type = 'from_meetings') for traceability.
-- Enables "View source transcripts" in In-Person Diagnostic panel.

ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS source_meeting_ids UUID[] DEFAULT NULL;

COMMENT ON COLUMN diagnostic_audits.source_meeting_ids IS 'Meeting record IDs used to build this audit when audit_type = from_meetings';
