-- Outreach drafts created in `outreach_queue` (by the in-app generate route AND
-- by the n8n WF-CLG-002 workflow) never showed up in the Admin Email Center,
-- because Email Center reads from `email_messages` and nothing was writing a
-- draft row there. The success pill linked users straight to an empty page.
--
-- Fix: index every email/linkedin row from `outreach_queue` into `email_messages`
-- as `status='draft'` with `transport='n8n'` (for drafts created by the n8n
-- outreach workflow; the in-app path can overwrite this later when we track
-- that distinction). Deduped by (source_system='outreach_queue', source_id=<uuid>)
-- so retries/backfills are idempotent.
--
-- Scope:
--   1. Create trigger function + trigger on `outreach_queue` (AFTER INSERT).
--   2. Backfill existing `outreach_queue` rows.
--
-- Note: We intentionally do NOT sync on UPDATE yet — the send pipeline is still
-- being built. Once the actual-send path is wired, it should UPDATE the
-- existing `email_messages` row by (source_system, source_id) rather than
-- inserting a duplicate.

CREATE OR REPLACE FUNCTION public.trg_outreach_queue_to_email_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.channel NOT IN ('email', 'linkedin') THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard (belt-and-suspenders; the backfill also uses this key).
  IF EXISTS (
    SELECT 1
    FROM public.email_messages
    WHERE source_system = 'outreach_queue'
      AND source_id = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.email_messages (
    email_kind,
    channel,
    contact_submission_id,
    contact_communication_id,
    recipient_email,
    subject,
    body_preview,
    direction,
    status,
    transport,
    source_system,
    source_id,
    context_json,
    metadata,
    sent_at,
    created_at
  )
  SELECT
    'cold_outreach',
    NEW.channel,
    NEW.contact_submission_id,
    NULL,
    CASE WHEN NEW.channel = 'email' THEN cs.email ELSE NULL END,
    NEW.subject,
    LEFT(COALESCE(NEW.body, ''), 500),
    'outbound',
    CASE
      WHEN NEW.status = 'rejected'  THEN 'failed'
      WHEN NEW.status = 'cancelled' THEN 'failed'
      WHEN NEW.status = 'approved'  THEN 'queued'
      WHEN NEW.status IN ('draft', 'queued', 'sending', 'sent', 'failed',
                           'bounced', 'replied', 'delivered', 'complained',
                           'opened', 'clicked', 'delivery_delayed')
        THEN NEW.status
      ELSE 'draft'
    END,
    'n8n',
    'outreach_queue',
    NEW.id::text,
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'sequence_step',              NEW.sequence_step,
      'sequence_id',                NEW.sequence_id,
      'generation_model',           NEW.generation_model,
      'generation_prompt_summary',  NEW.generation_prompt_summary,
      'original_queue_status',      NEW.status
    )),
    NEW.sent_at,
    COALESCE(NEW.created_at, now())
  FROM public.contact_submissions cs
  WHERE cs.id = NEW.contact_submission_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outreach_queue_email_messages ON public.outreach_queue;
CREATE TRIGGER trg_outreach_queue_email_messages
  AFTER INSERT ON public.outreach_queue
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_outreach_queue_to_email_messages();

-- Backfill existing rows (idempotent via the dedupe WHERE NOT EXISTS).
INSERT INTO public.email_messages (
  email_kind,
  channel,
  contact_submission_id,
  contact_communication_id,
  recipient_email,
  subject,
  body_preview,
  direction,
  status,
  transport,
  source_system,
  source_id,
  context_json,
  metadata,
  sent_at,
  created_at
)
SELECT
  'cold_outreach',
  oq.channel,
  oq.contact_submission_id,
  NULL,
  CASE WHEN oq.channel = 'email' THEN cs.email ELSE NULL END,
  oq.subject,
  LEFT(COALESCE(oq.body, ''), 500),
  'outbound',
  CASE
    WHEN oq.status IN ('draft', 'queued', 'sending', 'sent', 'failed',
                        'bounced', 'replied', 'delivered', 'complained',
                        'opened', 'clicked', 'delivery_delayed')
      THEN oq.status
    ELSE 'draft'
  END,
  'n8n',
  'outreach_queue',
  oq.id::text,
  '{}'::jsonb,
  jsonb_strip_nulls(jsonb_build_object(
    'sequence_step',              oq.sequence_step,
    'sequence_id',                oq.sequence_id,
    'generation_model',           oq.generation_model,
    'generation_prompt_summary',  oq.generation_prompt_summary
  )),
  oq.sent_at,
  COALESCE(oq.created_at, now())
FROM public.outreach_queue oq
LEFT JOIN public.contact_submissions cs ON cs.id = oq.contact_submission_id
WHERE oq.channel IN ('email', 'linkedin')
  AND NOT EXISTS (
    SELECT 1 FROM public.email_messages em
    WHERE em.source_system = 'outreach_queue'
      AND em.source_id = oq.id::text
  );
