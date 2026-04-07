-- Standalone audits must have a linked contact when completed.
-- Chat, in_person, from_meetings are excluded (soft gate for chat).
ALTER TABLE diagnostic_audits
  ADD CONSTRAINT chk_standalone_completed_has_contact
  CHECK (
    NOT (audit_type = 'standalone' AND status = 'completed' AND contact_submission_id IS NULL)
  );
