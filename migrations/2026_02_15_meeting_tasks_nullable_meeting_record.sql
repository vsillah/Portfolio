-- Allow meeting_action_tasks.meeting_record_id to be NULL
-- Required for system-generated tasks (e.g. upsell follow-up scheduling)
-- that are not associated with a specific meeting record.
--
-- Applied directly to the database on 2026-02-15.

ALTER TABLE meeting_action_tasks ALTER COLUMN meeting_record_id DROP NOT NULL;
