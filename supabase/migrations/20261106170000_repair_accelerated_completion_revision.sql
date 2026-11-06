-- Repair the qualified revision update in the previously staged completion function.
CREATE OR REPLACE FUNCTION public.accelerated_commit_completion_workspace(
  p_user_id uuid, p_version text, p_worksheet_id uuid, p_answers jsonb,
  p_expected_revision bigint, p_command_id uuid, p_action text,
  p_payload_sha256 text, p_intake_sha256 text,
  p_learner_name text, p_learner_email text, p_consent boolean
) RETURNS TABLE(revision bigint, replay boolean, intake_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_enrollment public.accelerated_member_enrollments%ROWTYPE;
  v_command public.accelerated_completion_commands%ROWTYPE;
  v_worksheet public.accelerated_member_worksheets%ROWTYPE;
  v_intake uuid;
  v_key text;
BEGIN
  IF p_user_id IS NULL OR p_worksheet_id IS NULL OR p_command_id IS NULL
     OR p_version IS NULL OR char_length(p_version) NOT BETWEEN 1 AND 120
     OR p_action NOT IN ('save','delete','submit')
     OR p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_payload_sha256 !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object'
     OR octet_length(p_answers::text) > 32000 THEN
    RAISE EXCEPTION 'Invalid completion workspace command' USING ERRCODE = '22023';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_answers) LOOP
    IF v_key !~ '^L(0[1-9]|1[0-6])$' OR jsonb_typeof(p_answers->v_key) <> 'string'
       OR char_length(p_answers->>v_key) > 4000 THEN
      RAISE EXCEPTION 'Invalid lesson answer' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  SELECT * INTO v_enrollment FROM public.accelerated_member_enrollments
    WHERE user_id = p_user_id AND content_version = p_version FOR UPDATE;
  IF NOT FOUND OR v_enrollment.claim_sha256 IS NULL THEN
    RAISE EXCEPTION 'Claim member progress before editing the Decision File' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_command FROM public.accelerated_completion_commands WHERE command_id = p_command_id;
  IF FOUND THEN
    IF v_command.user_id IS DISTINCT FROM p_user_id
       OR v_command.content_version IS DISTINCT FROM p_version
       OR v_command.worksheet_id IS DISTINCT FROM p_worksheet_id
       OR v_command.action IS DISTINCT FROM p_action
       OR v_command.expected_revision IS DISTINCT FROM p_expected_revision
       OR v_command.payload_sha256 IS DISTINCT FROM p_payload_sha256
       OR v_enrollment.revision IS DISTINCT FROM v_command.resulting_revision THEN
      RAISE EXCEPTION 'Completion command is stale or belongs to another request' USING ERRCODE = 'P0001';
    END IF;
    RETURN QUERY SELECT v_command.resulting_revision, true, v_command.intake_id;
    RETURN;
  END IF;
  IF v_enrollment.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'Member work changed on another device. Reload before continuing' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_worksheet FROM public.accelerated_member_worksheets
    WHERE user_id = p_user_id AND content_version = p_version FOR UPDATE;
  IF NOT FOUND OR v_worksheet.worksheet_id <> p_worksheet_id THEN
    RAISE EXCEPTION 'Worksheet identity does not belong to this member' USING ERRCODE = 'P0001';
  END IF;
  IF p_action = 'delete' AND p_answers <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Delete requires an empty worksheet' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'submit' THEN
    IF p_consent IS DISTINCT FROM true OR char_length(btrim(p_learner_name)) NOT BETWEEN 1 AND 120
       OR char_length(btrim(p_learner_email)) NOT BETWEEN 1 AND 254
       OR p_intake_sha256 !~ '^[0-9a-f]{64}$'
       OR NOT EXISTS (SELECT 1 FROM jsonb_each_text(p_answers) x WHERE btrim(x.value) <> '') THEN
      RAISE EXCEPTION 'Review, identity, answers and consent are required' USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.accelerated_member_worksheets SET answers = p_answers, updated_at = now()
    WHERE worksheet_id = p_worksheet_id AND user_id = p_user_id AND content_version = p_version;
  IF p_action = 'submit' THEN
    SELECT result.id INTO v_intake FROM public.accelerated_submit_member_decision_file(
      p_user_id, p_worksheet_id, p_version, p_intake_sha256,
      p_learner_name, p_learner_email, p_answers, now()
    ) result;
    IF v_intake IS NULL THEN RAISE EXCEPTION 'Submission receipt missing' USING ERRCODE = 'P0001'; END IF;
  END IF;
  UPDATE public.accelerated_member_enrollments SET revision = accelerated_member_enrollments.revision + 1, updated_at = now()
    WHERE user_id = p_user_id AND content_version = p_version;
  INSERT INTO public.accelerated_completion_commands(
    command_id,user_id,content_version,worksheet_id,action,expected_revision,resulting_revision,payload_sha256,intake_id
  ) VALUES (p_command_id,p_user_id,p_version,p_worksheet_id,p_action,p_expected_revision,p_expected_revision + 1,p_payload_sha256,v_intake);
  RETURN QUERY SELECT p_expected_revision + 1, false, v_intake;
END $$;
