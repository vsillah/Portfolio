-- Execute as one batch against a disposable local database or staging.
-- Synthetic rows and the issued token are rolled back.
BEGIN;

DO $test$
DECLARE
  v_user uuid := gen_random_uuid();
  v_version text := 'agentified-l01-l16-de1e01f0';
  v_first record;
  v_replay record;
BEGIN
  INSERT INTO auth.users(id) VALUES (v_user);
  INSERT INTO public.accelerated_member_enrollments(user_id,content_version,claim_sha256)
    VALUES (v_user,v_version,repeat('a',64));
  INSERT INTO public.accelerated_member_lessons(user_id,content_version,lesson_id,completed_at)
    SELECT v_user,v_version,'L' || lpad(n::text,2,'0'),now()
    FROM generate_series(1,15) AS n;

  BEGIN
    PERFORM public.accelerated_claim_completion_credential(v_user,v_version,'Synthetic Learner',repeat('b',64));
    RAISE EXCEPTION 'Claim unexpectedly succeeded with fifteen lessons' USING ERRCODE = 'P9999';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF EXISTS (SELECT 1 FROM public.accelerated_completion_credentials WHERE user_id=v_user) THEN
      RAISE EXCEPTION 'Premature claim persisted a credential';
    END IF;
  END;

  INSERT INTO public.accelerated_member_lessons(user_id,content_version,lesson_id,completed_at)
    VALUES (v_user,v_version,'L16',now());
  SELECT * INTO v_first FROM public.accelerated_claim_completion_credential(
    v_user,v_version,'Synthetic Learner',repeat('b',64));
  IF v_first.replay OR v_first.learner_name <> 'Synthetic Learner'
     OR v_first.verification_token <> repeat('b',64) OR v_first.revision <> 1
     OR v_first.completed_at IS NULL THEN
    RAISE EXCEPTION 'Initial credential receipt failed';
  END IF;

  SELECT * INTO v_replay FROM public.accelerated_claim_completion_credential(
    v_user,v_version,'Synthetic Learner',repeat('c',64));
  IF NOT v_replay.replay OR v_replay.verification_token <> v_first.verification_token
     OR v_replay.completed_at <> v_first.completed_at
     OR (SELECT count(*) FROM public.accelerated_completion_credentials WHERE user_id=v_user) <> 1 THEN
    RAISE EXCEPTION 'Credential replay changed issuance';
  END IF;

  BEGIN
    PERFORM public.accelerated_claim_completion_credential(v_user,v_version,'Different Name',repeat('d',64));
    RAISE EXCEPTION 'Identity change unexpectedly succeeded' USING ERRCODE = 'P9999';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
END $test$;

ROLLBACK;
