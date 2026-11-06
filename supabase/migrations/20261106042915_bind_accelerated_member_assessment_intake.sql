-- Bind a consented Decision File intake to the authenticated member worksheet
-- without implying paid-client project access.
CREATE OR REPLACE FUNCTION public.accelerated_submit_member_decision_file(
  p_user_id uuid,
  p_worksheet_id uuid,
  p_content_version text,
  p_payload_sha256 text,
  p_learner_name text,
  p_learner_email text,
  p_answers jsonb,
  p_consented_at timestamptz
) RETURNS TABLE(id uuid, replay boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_member_answers jsonb;
  v_existing public.accelerated_decision_file_intakes%ROWTYPE;
  v_owner uuid;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_worksheet_id IS NULL
     OR char_length(btrim(p_content_version)) NOT BETWEEN 1 AND 120
     OR p_payload_sha256 !~ '^[0-9a-f]{64}$'
     OR char_length(btrim(p_learner_name)) NOT BETWEEN 1 AND 120
     OR char_length(btrim(p_learner_email)) NOT BETWEEN 1 AND 254
     OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object'
     OR octet_length(p_answers::text) > 32000
     OR p_consented_at IS NULL THEN
    RAISE EXCEPTION 'Invalid member Decision File submission' USING ERRCODE = '22023';
  END IF;

  SELECT answers INTO v_member_answers
  FROM public.accelerated_member_worksheets
  WHERE user_id = p_user_id
    AND worksheet_id = p_worksheet_id
    AND content_version = p_content_version
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The worksheet is not linked to this member profile' USING ERRCODE = 'P0001';
  END IF;
  IF v_member_answers IS DISTINCT FROM p_answers THEN
    RAISE EXCEPTION 'Save the latest worksheet to your profile before assessment review' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing
  FROM public.accelerated_decision_file_intakes
  WHERE worksheet_id = p_worksheet_id
  FOR UPDATE;

  IF FOUND THEN
    SELECT user_id INTO v_owner
    FROM public.accelerated_decision_file_owners
    WHERE intake_id = v_existing.id;
    IF v_existing.payload_sha256 IS DISTINCT FROM p_payload_sha256
       OR v_owner IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'This worksheet already has different assessment evidence' USING ERRCODE = 'P0001';
    END IF;
    RETURN QUERY SELECT v_existing.id, true;
    RETURN;
  END IF;

  INSERT INTO public.accelerated_decision_file_intakes(
    worksheet_id,
    content_version,
    payload_sha256,
    learner_name,
    learner_email,
    answers,
    consented_at
  ) VALUES (
    p_worksheet_id,
    p_content_version,
    p_payload_sha256,
    btrim(p_learner_name),
    lower(btrim(p_learner_email)),
    p_answers,
    p_consented_at
  ) RETURNING accelerated_decision_file_intakes.id INTO v_id;

  INSERT INTO public.accelerated_decision_file_owners(intake_id, user_id)
  VALUES (v_id, p_user_id);

  RETURN QUERY SELECT v_id, false;
END
$$;

REVOKE ALL ON FUNCTION public.accelerated_submit_member_decision_file(uuid,uuid,text,text,text,text,jsonb,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_submit_member_decision_file(uuid,uuid,text,text,text,text,jsonb,timestamptz)
  TO service_role;

COMMENT ON FUNCTION public.accelerated_submit_member_decision_file(uuid,uuid,text,text,text,text,jsonb,timestamptz)
  IS 'Atomically records consented assessment intake for an exact authenticated member worksheet; it does not grant client-project access.';
