-- Meeting context for sequence-driven outreach drafts: one open draft per
-- (contact, channel, sequence_step, template_key, context_meeting_record_id)
-- is enforced in app; this column records which meeting's notes were used.

ALTER TABLE public.outreach_queue
  ADD COLUMN IF NOT EXISTS context_meeting_record_id UUID
    REFERENCES public.meeting_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_queue_context_meeting
  ON public.outreach_queue (contact_submission_id, context_meeting_record_id)
  WHERE context_meeting_record_id IS NOT NULL;

COMMENT ON COLUMN public.outreach_queue.context_meeting_record_id IS
  'Meeting whose context was used for this draft (sequence-driven rows). NULL = legacy or no meeting notes.';
