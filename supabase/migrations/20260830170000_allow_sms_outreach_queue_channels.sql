ALTER TABLE public.outreach_queue
  DROP CONSTRAINT IF EXISTS outreach_queue_channel_check;

ALTER TABLE public.outreach_queue
  ADD CONSTRAINT outreach_queue_channel_check
  CHECK (channel IN ('email', 'linkedin', 'sms', 'phone_contact'));
