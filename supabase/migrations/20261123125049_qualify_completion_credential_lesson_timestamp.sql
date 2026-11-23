-- The RETURNS TABLE output field completed_at shadows the lesson column in
-- PL/pgSQL. Qualify the lesson timestamp while preserving issuance rules.
CREATE OR REPLACE FUNCTION public.accelerated_claim_completion_credential(
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
     OR (SELECT count(*) FROM public.accelerated_member_lessons AS lessons
         WHERE lessons.user_id = p_user_id AND lessons.content_version = p_version
           AND lessons.completed_at IS NOT NULL) <> 16 THEN
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
