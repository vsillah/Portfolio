-- Read.ai analytics URL id (e.g. .../meetings/01KNHYS5S4P7J9ZE8XF6ZGQEB1) for dedupe across
-- multiple Slack events / messages for the same recap (Slack event_id dedupe is not enough).

ALTER TABLE public.meeting_records
  ADD COLUMN IF NOT EXISTS read_ai_meeting_id TEXT NULL;

COMMENT ON COLUMN public.meeting_records.read_ai_meeting_id IS
  'Read.ai analytics meeting id from transcript URL; unique when set to prevent duplicate rows from multi-message Slack intake.';

-- Backfill from transcript text
UPDATE public.meeting_records
SET read_ai_meeting_id = (regexp_match(transcript, 'read\.ai/analytics/meetings/([A-Za-z0-9]+)', 'i'))[1]
WHERE transcript IS NOT NULL
  AND transcript ~* 'read\.ai/analytics/meetings/'
  AND (read_ai_meeting_id IS NULL OR read_ai_meeting_id = '');

-- Drop duplicate rows per read_ai_meeting_id (keep oldest by created_at)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY read_ai_meeting_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.meeting_records
  WHERE read_ai_meeting_id IS NOT NULL
    AND read_ai_meeting_id != ''
)
DELETE FROM public.meeting_records mr
USING ranked r
WHERE mr.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_records_read_ai_meeting_id_unique
  ON public.meeting_records (read_ai_meeting_id)
  WHERE read_ai_meeting_id IS NOT NULL AND read_ai_meeting_id != '';
