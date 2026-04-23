-- n8n / admin-triggered CLG-002 run tracking (mirrors last_vep_* pattern)

ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS last_n8n_outreach_triggered_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS last_n8n_outreach_status TEXT DEFAULT NULL;

ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS last_n8n_outreach_template_key TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contact_submissions_last_n8n_outreach_status_check'
  ) THEN
    ALTER TABLE contact_submissions
    ADD CONSTRAINT contact_submissions_last_n8n_outreach_status_check
    CHECK (
      last_n8n_outreach_status IS NULL
      OR last_n8n_outreach_status IN ('pending', 'success', 'failed')
    );
  END IF;
END $$;

COMMENT ON COLUMN contact_submissions.last_n8n_outreach_triggered_at IS
  'Set when n8n CLG-002 (or in-app) outreach generation is started for this contact; cleared when acked';

COMMENT ON COLUMN contact_submissions.last_n8n_outreach_status IS
  'pending after trigger; success when outreach_queue has email or in-app row; failed on error or user cancel-wait';

COMMENT ON COLUMN contact_submissions.last_n8n_outreach_template_key IS
  'EMAIL_TEMPLATE_KEYS value (or in_app) for the last n8n/in-app run';

-- When n8n (or in-app) inserts a draft, mark the contact success if a CLG run was still pending
CREATE OR REPLACE FUNCTION public.trg_outreach_queue_mark_n8n_success()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.channel = 'email' AND TG_OP = 'INSERT' THEN
    UPDATE public.contact_submissions cs
    SET last_n8n_outreach_status = 'success'
    WHERE cs.id = NEW.contact_submission_id
      AND cs.last_n8n_outreach_status = 'pending'
      AND cs.last_n8n_outreach_triggered_at IS NOT NULL
      AND NEW.created_at >= (cs.last_n8n_outreach_triggered_at - interval '2 minutes');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outreach_queue_n8n_success ON public.outreach_queue;

CREATE TRIGGER trg_outreach_queue_n8n_success
  AFTER INSERT ON public.outreach_queue
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_outreach_queue_mark_n8n_success();

COMMENT ON FUNCTION public.trg_outreach_queue_mark_n8n_success() IS
  'Sets last_n8n_outreach_status to success when an email draft is inserted and a n8n run is pending';
