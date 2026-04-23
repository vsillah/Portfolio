-- When GPT-4o (or any LLM) refuses to write outreach copy, the "draft" that
-- lands in outreach_queue is just a refusal template like:
--   "I'm sorry, I can't assist with that request."
--
-- These rows look valid to the rest of the pipeline (status = 'draft') but are
-- not usable copy. Flag them automatically so reviewers can re-run before
-- anything gets sent, and so the Email Center shows the correct status.
--
-- Approach: BEFORE INSERT trigger on outreach_queue. If the body (or LinkedIn
-- body, which contains both the connection note and follow-up DM) matches a
-- known refusal prefix, downgrade status from 'draft' → 'rejected' (the only
-- terminal-failure status allowed by outreach_queue_status_check) and tag the
-- reason in generation_prompt_summary. The email_messages mirror trigger
-- translates 'rejected' → 'failed' when indexing, so Email Center still shows
-- a red failed row.

CREATE OR REPLACE FUNCTION public.trg_outreach_queue_flag_refusal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sample text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'draft' THEN
    RETURN NEW;
  END IF;

  sample := LOWER(TRIM(COALESCE(NEW.body, '')));
  IF sample = '' THEN
    RETURN NEW;
  END IF;

  -- LinkedIn body starts with "CONNECTION NOTE:\n<text>\n\nFOLLOW-UP DM:\n<text>"
  -- so we strip the label prefix before running the check.
  sample := regexp_replace(sample, '^connection note:\s*', '', 'i');

  IF sample LIKE ANY (ARRAY[
    'i''m sorry%',
    'i am sorry%',
    'sorry, %',
    'i cannot %',
    'i can''t %',
    'i can not %',
    'i apologize%',
    'as an ai %',
    'as a language model%',
    'i''m unable to %',
    'i am unable to %',
    'unfortunately, i cannot%',
    'unfortunately, i can''t%'
  ]) THEN
    NEW.status := 'rejected';
    NEW.generation_prompt_summary :=
      'LLM refusal detected and flagged automatically. Original summary: '
      || COALESCE(NEW.generation_prompt_summary, '(none)');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outreach_queue_flag_refusal ON public.outreach_queue;
CREATE TRIGGER trg_outreach_queue_flag_refusal
  BEFORE INSERT ON public.outreach_queue
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_outreach_queue_flag_refusal();

-- Backfill: flag existing refusal drafts so the Email Center + outreach UI
-- show the correct status immediately.
UPDATE public.outreach_queue
   SET status = 'rejected',
       generation_prompt_summary =
         'LLM refusal detected and flagged automatically. Original summary: '
         || COALESCE(generation_prompt_summary, '(none)')
 WHERE status = 'draft'
   AND (
        LOWER(TRIM(COALESCE(body, ''))) LIKE 'i''m sorry%'
     OR LOWER(TRIM(COALESCE(body, ''))) LIKE 'i am sorry%'
     OR LOWER(TRIM(COALESCE(body, ''))) LIKE 'sorry, %'
     OR LOWER(TRIM(COALESCE(body, ''))) LIKE 'i cannot %'
     OR LOWER(TRIM(COALESCE(body, ''))) LIKE 'i can''t %'
     OR LOWER(TRIM(COALESCE(body, ''))) LIKE 'i can not %'
     OR LOWER(TRIM(COALESCE(body, ''))) LIKE 'i apologize%'
     OR LOWER(TRIM(COALESCE(body, ''))) LIKE 'as an ai %'
     OR LOWER(TRIM(COALESCE(body, ''))) LIKE 'as a language model%'
     OR LOWER(regexp_replace(TRIM(COALESCE(body, '')), '^CONNECTION NOTE:\s*', '', 'i')) LIKE 'i''m sorry%'
     OR LOWER(regexp_replace(TRIM(COALESCE(body, '')), '^CONNECTION NOTE:\s*', '', 'i')) LIKE 'sorry, %'
   );

-- Mirror the new status into email_messages for rows already backfilled.
UPDATE public.email_messages em
   SET status = 'failed',
       metadata = COALESCE(em.metadata, '{}'::jsonb)
                  || jsonb_build_object('flagged_reason', 'llm_refusal')
  FROM public.outreach_queue oq
 WHERE em.source_system = 'outreach_queue'
   AND em.source_id = oq.id::text
   AND oq.status = 'rejected'
   AND em.status = 'draft'
   AND oq.generation_prompt_summary LIKE 'LLM refusal detected%';
