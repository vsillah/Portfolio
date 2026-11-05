-- Qualify the intake identity inside the transactional review function.
CREATE OR REPLACE FUNCTION public.accelerated_review_decision_file(
  p_intake_id uuid, p_status text, p_note text, p_audit_id bigint, p_reviewer uuid
) RETURNS TABLE(id uuid, review_status text, linked_audit_id bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_intake public.accelerated_decision_file_intakes%ROWTYPE;
  v_audit record;
  v_prior uuid;
  v_count integer;
BEGIN
  IF p_status NOT IN ('reviewing','linked','closed') OR char_length(p_note) > 2000 THEN
    RAISE EXCEPTION 'Invalid review command' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_intake FROM public.accelerated_decision_file_intakes AS intake WHERE intake.id = p_intake_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Decision file not found' USING ERRCODE = 'P0001'; END IF;
  IF p_status = 'linked' THEN
    SELECT a.user_id, c.email INTO v_audit FROM public.diagnostic_audits a
      JOIN public.contact_submissions c ON c.id = a.contact_submission_id WHERE a.id = p_audit_id;
    IF NOT FOUND OR lower(btrim(v_audit.email)) IS DISTINCT FROM lower(btrim(v_intake.learner_email)) THEN
      RAISE EXCEPTION 'Assessment contact does not match the worksheet learner' USING ERRCODE = 'P0001';
    END IF;
    IF v_audit.user_id IS NOT NULL THEN
      SELECT user_id INTO v_prior FROM public.accelerated_decision_file_owners WHERE intake_id = p_intake_id;
      IF FOUND AND v_prior <> v_audit.user_id THEN
        RAISE EXCEPTION 'This Decision File is already owned by another member' USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO public.accelerated_decision_file_owners(intake_id,user_id,verified_by)
      VALUES (p_intake_id,v_audit.user_id,p_reviewer) ON CONFLICT (intake_id) DO NOTHING;
    END IF;
  END IF;
  UPDATE public.accelerated_decision_file_intakes SET review_status = p_status,
    linked_audit_id = CASE WHEN p_status = 'linked' THEN p_audit_id ELSE linked_audit_id END,
    review_note = btrim(p_note), reviewed_by = p_reviewer, reviewed_at = now()
    WHERE accelerated_decision_file_intakes.id = p_intake_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Decision File review was not recorded' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY SELECT p_intake_id,p_status,CASE WHEN p_status = 'linked' THEN p_audit_id ELSE v_intake.linked_audit_id END;
END $$;
