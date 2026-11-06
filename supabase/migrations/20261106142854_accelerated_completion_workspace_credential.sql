-- Staging prerequisite provenance: repository 20261106042915 is recorded in
-- staging as 20261106043153. The installed SQL is semantically identical.
CREATE TABLE public.accelerated_completion_commands (
  command_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_version text NOT NULL,
  worksheet_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('save','delete','submit')),
  expected_revision bigint NOT NULL,
  resulting_revision bigint NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  intake_id uuid REFERENCES public.accelerated_decision_file_intakes(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accelerated_completion_commands_owner_idx ON public.accelerated_completion_commands(user_id, content_version);
ALTER TABLE public.accelerated_completion_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accelerated_completion_commands FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.accelerated_completion_commands TO service_role;

CREATE TABLE public.accelerated_completion_credentials (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_version text NOT NULL,
  learner_name text NOT NULL CHECK (char_length(learner_name) BETWEEN 1 AND 120),
  completed_at timestamptz NOT NULL DEFAULT now(),
  verification_token text UNIQUE CHECK (verification_token ~ '^[0-9a-f]{64}$'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  PRIMARY KEY (user_id, content_version),
  FOREIGN KEY (user_id, content_version) REFERENCES public.accelerated_member_enrollments(user_id, content_version) ON DELETE CASCADE
);
ALTER TABLE public.accelerated_completion_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accelerated_completion_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.accelerated_completion_credentials TO service_role;

CREATE FUNCTION public.accelerated_commit_completion_workspace(
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
REVOKE ALL ON FUNCTION public.accelerated_commit_completion_workspace(uuid,text,uuid,jsonb,bigint,uuid,text,text,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_commit_completion_workspace(uuid,text,uuid,jsonb,bigint,uuid,text,text,text,text,text,boolean) TO service_role;

CREATE FUNCTION public.accelerated_claim_completion_credential(
  p_user_id uuid, p_version text, p_name text, p_token text
) RETURNS TABLE(learner_name text, completed_at timestamptz, verification_token text, revision bigint, replay boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_enrollment public.accelerated_member_enrollments%ROWTYPE;
  v_credential public.accelerated_completion_credentials%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_version IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 120
     OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid credential claim' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_enrollment FROM public.accelerated_member_enrollments
    WHERE user_id = p_user_id AND content_version = p_version FOR UPDATE;
  IF NOT FOUND OR v_enrollment.claim_sha256 IS NULL
     OR (SELECT count(*) FROM public.accelerated_member_lessons
         WHERE user_id = p_user_id AND content_version = p_version AND completed_at IS NOT NULL) <> 16 THEN
    RAISE EXCEPTION 'Complete and save all sixteen lessons before claiming' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_credential FROM public.accelerated_completion_credentials
    WHERE user_id = p_user_id AND content_version = p_version FOR UPDATE;
  IF FOUND THEN
    IF v_credential.learner_name <> btrim(p_name) THEN
      RAISE EXCEPTION 'Credential identity is fixed after claim' USING ERRCODE = 'P0001';
    END IF;
    RETURN QUERY SELECT v_credential.learner_name,v_credential.completed_at,v_credential.verification_token,v_credential.revision,true;
    RETURN;
  END IF;
  INSERT INTO public.accelerated_completion_credentials(user_id,content_version,learner_name,verification_token)
    VALUES (p_user_id,p_version,btrim(p_name),p_token)
    RETURNING * INTO v_credential;
  RETURN QUERY SELECT v_credential.learner_name,v_credential.completed_at,v_credential.verification_token,v_credential.revision,false;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_claim_completion_credential(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_claim_completion_credential(uuid,text,text,text) TO service_role;

CREATE FUNCTION public.accelerated_change_completion_link(
  p_user_id uuid, p_version text, p_expected_revision bigint, p_action text, p_token text
) RETURNS TABLE(verification_token text, revision bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_row public.accelerated_completion_credentials%ROWTYPE;
BEGIN
  IF p_action NOT IN ('revoke','rotate') OR p_expected_revision IS NULL OR p_expected_revision < 1
     OR (p_action = 'rotate' AND p_token !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'Invalid link change' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM public.accelerated_completion_credentials
    WHERE user_id = p_user_id AND content_version = p_version FOR UPDATE;
  IF NOT FOUND OR v_row.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'Credential link changed. Reload before continuing' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.accelerated_completion_credentials SET
    verification_token = CASE WHEN p_action = 'revoke' THEN NULL ELSE p_token END,
    revision = revision + 1
    WHERE user_id = p_user_id AND content_version = p_version
    RETURNING * INTO v_row;
  RETURN QUERY SELECT v_row.verification_token,v_row.revision;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_change_completion_link(uuid,text,bigint,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_change_completion_link(uuid,text,bigint,text,text) TO service_role;
