-- Qualify the enrollment revision inside the transactional progress function.
CREATE OR REPLACE FUNCTION public.accelerated_write_member_progress(
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
  UPDATE public.accelerated_member_enrollments AS enrollment SET
    current_lesson_id = p_state->>'currentLessonId',
    claim_sha256 = CASE WHEN p_action = 'claim' THEN p_claim_sha256 ELSE enrollment.claim_sha256 END,
    revision = enrollment.revision + 1, updated_at = now()
    WHERE enrollment.user_id = p_user_id AND enrollment.content_version = p_version AND enrollment.revision = p_expected_revision;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Member progress changed during save' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY SELECT p_expected_revision + 1, false;
END $$;
