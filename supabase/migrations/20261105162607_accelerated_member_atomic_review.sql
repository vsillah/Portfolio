-- Both commands execute as one PostgREST transaction, with row locks and service-role-only access.
ALTER TABLE public.accelerated_member_enrollments ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0);

CREATE FUNCTION public.accelerated_write_member_progress(
  p_user_id uuid, p_version text, p_state jsonb, p_action text,
  p_expected_revision bigint, p_claim_sha256 text
) RETURNS TABLE(revision bigint, replay boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_enrollment public.accelerated_member_enrollments%ROWTYPE;
  v_worksheet uuid;
  v_owner uuid;
  v_lesson text;
  v_count integer;
BEGIN
  IF p_action NOT IN ('claim', 'save') OR p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_claim_sha256 !~ '^[0-9a-f]{64}$' OR p_state->>'version' IS DISTINCT FROM p_version THEN
    RAISE EXCEPTION 'Invalid progress command' USING ERRCODE = '22023';
  END IF;
  v_worksheet := (p_state->'worksheet'->>'worksheetId')::uuid;
  IF v_worksheet IS NULL THEN RAISE EXCEPTION 'Worksheet identity required' USING ERRCODE = '22023'; END IF;
  IF p_action = 'claim' THEN
    INSERT INTO public.accelerated_member_enrollments(user_id, content_version)
    VALUES (p_user_id, p_version) ON CONFLICT DO NOTHING;
  END IF;
  SELECT * INTO v_enrollment FROM public.accelerated_member_enrollments
    WHERE user_id = p_user_id AND content_version = p_version FOR UPDATE;
  IF NOT FOUND OR (p_action = 'save' AND v_enrollment.claim_sha256 IS NULL) THEN
    RAISE EXCEPTION 'Claim guest progress before saving member changes' USING ERRCODE = 'P0001';
  END IF;
  IF p_action = 'claim' AND v_enrollment.claim_sha256 IS NOT NULL THEN
    IF v_enrollment.claim_sha256 <> p_claim_sha256 THEN
      RAISE EXCEPTION 'Guest progress was already claimed with different evidence' USING ERRCODE = 'P0001';
    END IF;
    RETURN QUERY SELECT v_enrollment.revision, true;
    RETURN;
  END IF;
  IF v_enrollment.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'Member progress changed on another device. Reload before saving' USING ERRCODE = 'P0001';
  END IF;
  SELECT user_id INTO v_owner FROM public.accelerated_member_worksheets WHERE worksheet_id = v_worksheet;
  IF FOUND AND v_owner <> p_user_id THEN
    RAISE EXCEPTION 'This worksheet belongs to another member' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accelerated_member_worksheets
    WHERE user_id = p_user_id AND content_version = p_version AND worksheet_id <> v_worksheet) THEN
    RAISE EXCEPTION 'This member already has a different worksheet for this course edition' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.accelerated_member_worksheets(worksheet_id,user_id,content_version,answers,updated_at)
  VALUES (v_worksheet,p_user_id,p_version,p_state->'worksheet'->'answers',now())
  ON CONFLICT (worksheet_id) DO UPDATE SET answers = EXCLUDED.answers, updated_at = now();
  FOR v_lesson IN SELECT lesson_id FROM public.accelerated_member_lessons
    WHERE user_id = p_user_id AND content_version = p_version
    UNION SELECT jsonb_array_elements_text(p_state->'completed')
    UNION SELECT jsonb_object_keys(p_state->'videoSeconds')
  LOOP
    INSERT INTO public.accelerated_member_lessons(user_id,content_version,lesson_id,completed_at,video_seconds,updated_at)
    VALUES (p_user_id,p_version,v_lesson,
      CASE WHEN p_state->'completed' ? v_lesson THEN now() ELSE NULL END,
      COALESCE((p_state->'videoSeconds'->>v_lesson)::integer,0),now())
    ON CONFLICT (user_id,content_version,lesson_id) DO UPDATE SET
      completed_at = EXCLUDED.completed_at, video_seconds = EXCLUDED.video_seconds, updated_at = now();
  END LOOP;
  UPDATE public.accelerated_member_enrollments SET
    current_lesson_id = p_state->>'currentLessonId',
    claim_sha256 = CASE WHEN p_action = 'claim' THEN p_claim_sha256 ELSE claim_sha256 END,
    revision = revision + 1, updated_at = now()
    WHERE user_id = p_user_id AND content_version = p_version AND revision = p_expected_revision;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Member progress changed during save' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY SELECT p_expected_revision + 1, false;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_write_member_progress(uuid,text,jsonb,text,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_write_member_progress(uuid,text,jsonb,text,bigint,text) TO service_role;

CREATE FUNCTION public.accelerated_review_decision_file(
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
  SELECT * INTO v_intake FROM public.accelerated_decision_file_intakes WHERE id = p_intake_id FOR UPDATE;
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
REVOKE ALL ON FUNCTION public.accelerated_review_decision_file(uuid,text,text,bigint,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_review_decision_file(uuid,text,text,bigint,uuid) TO service_role;

ALTER TABLE public.accelerated_member_recommendations
  ADD COLUMN intake_id uuid REFERENCES public.accelerated_decision_file_intakes(id) ON DELETE RESTRICT,
  ADD COLUMN audit_id bigint REFERENCES public.diagnostic_audits(id) ON DELETE RESTRICT,
  ADD CONSTRAINT accelerated_recommendation_approved_source CHECK
    (review_status <> 'approved' OR (intake_id IS NOT NULL AND audit_id IS NOT NULL));
CREATE UNIQUE INDEX accelerated_recommendation_source_offer_uidx
  ON public.accelerated_member_recommendations(intake_id,offer_kind,offer_id);

CREATE FUNCTION public.accelerated_approve_member_recommendation(
  p_intake_id uuid, p_audit_id bigint, p_offer_kind text, p_offer_id text,
  p_title text, p_rationale text, p_reviewer uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_intake public.accelerated_decision_file_intakes%ROWTYPE;
  v_user_id uuid;
  v_id uuid;
BEGIN
  SELECT * INTO v_intake FROM public.accelerated_decision_file_intakes WHERE id = p_intake_id FOR UPDATE;
  IF NOT FOUND OR v_intake.review_status <> 'linked' OR v_intake.linked_audit_id IS DISTINCT FROM p_audit_id THEN
    RAISE EXCEPTION 'Link this Decision File to the reviewed assessment first' USING ERRCODE = 'P0001';
  END IF;
  SELECT user_id INTO v_user_id FROM public.accelerated_decision_file_owners WHERE intake_id = p_intake_id;
  IF NOT FOUND OR v_user_id IS DISTINCT FROM (SELECT user_id FROM public.diagnostic_audits WHERE id = p_audit_id) THEN
    RAISE EXCEPTION 'Verified member ownership is required' USING ERRCODE = 'P0001';
  END IF;
  IF p_offer_kind = 'service' THEN
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE id::text = p_offer_id AND is_active) THEN
      RAISE EXCEPTION 'Offer is not active' USING ERRCODE = 'P0001'; END IF;
  ELSIF p_offer_kind = 'product' THEN
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id::text = p_offer_id AND is_active) THEN
      RAISE EXCEPTION 'Offer is not active' USING ERRCODE = 'P0001'; END IF;
  ELSE RAISE EXCEPTION 'Invalid offer kind' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.accelerated_member_recommendations
    (user_id,intake_id,audit_id,offer_kind,offer_id,title,rationale,review_status,reviewed_by,reviewed_at)
  VALUES (v_user_id,p_intake_id,p_audit_id,p_offer_kind,p_offer_id,p_title,p_rationale,'approved',p_reviewer,now())
  ON CONFLICT (intake_id,offer_kind,offer_id) DO UPDATE SET
    title = EXCLUDED.title, rationale = EXCLUDED.rationale, reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = now(), review_status = 'approved'
  WHERE accelerated_member_recommendations.user_id = EXCLUDED.user_id
    AND accelerated_member_recommendations.audit_id = EXCLUDED.audit_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Recommendation source identity changed' USING ERRCODE = 'P0001'; END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_approve_member_recommendation(uuid,bigint,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_approve_member_recommendation(uuid,bigint,text,text,text,text,uuid) TO service_role;
