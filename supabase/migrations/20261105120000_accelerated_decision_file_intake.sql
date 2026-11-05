-- Immutable learner evidence. Only server-side service role may read or write.
CREATE TABLE public.accelerated_decision_file_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id uuid NOT NULL UNIQUE,
  content_version text NOT NULL,
  payload_sha256 text NOT NULL,
  learner_name text NOT NULL,
  learner_email text NOT NULL,
  answers jsonb NOT NULL,
  consented_at timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','reviewing','linked','closed')),
  linked_audit_id bigint REFERENCES public.diagnostic_audits(id) ON DELETE RESTRICT,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  CONSTRAINT accelerated_answers_object CHECK (jsonb_typeof(answers) = 'object')
);
ALTER TABLE public.accelerated_decision_file_intakes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accelerated_decision_file_intakes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accelerated_decision_file_intakes TO service_role;
CREATE INDEX accelerated_decision_file_intakes_review_idx ON public.accelerated_decision_file_intakes (review_status, submitted_at DESC);
CREATE OR REPLACE FUNCTION public.guard_accelerated_decision_file_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.worksheet_id IS DISTINCT FROM OLD.worksheet_id OR
     NEW.content_version IS DISTINCT FROM OLD.content_version OR
     NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256 OR
     NEW.learner_name IS DISTINCT FROM OLD.learner_name OR
     NEW.learner_email IS DISTINCT FROM OLD.learner_email OR
     NEW.answers IS DISTINCT FROM OLD.answers OR
     NEW.consented_at IS DISTINCT FROM OLD.consented_at OR
     NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'Decision file evidence is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_accelerated_decision_file_evidence
BEFORE UPDATE ON public.accelerated_decision_file_intakes
FOR EACH ROW EXECUTE FUNCTION public.guard_accelerated_decision_file_evidence();
