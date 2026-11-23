-- The RETURNS TABLE output field revision shadows the credential column in
-- PL/pgSQL. Qualify the persisted revision without changing link semantics.
CREATE OR REPLACE FUNCTION public.accelerated_change_completion_link(
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
  UPDATE public.accelerated_completion_credentials AS credential SET
    verification_token = CASE WHEN p_action = 'revoke' THEN NULL ELSE p_token END,
    revision = credential.revision + 1
    WHERE user_id = p_user_id AND content_version = p_version
    RETURNING * INTO v_row;
  RETURN QUERY SELECT v_row.verification_token,v_row.revision;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_change_completion_link(uuid,text,bigint,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_change_completion_link(uuid,text,bigint,text,text) TO service_role;
