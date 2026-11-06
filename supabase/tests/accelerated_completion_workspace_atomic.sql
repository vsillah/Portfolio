-- Run as one batch against staging. All fixture rows, including the failure
-- trigger, remain inside this transaction and are rolled back at the end.
BEGIN;

DO $test$
DECLARE
  v_user uuid := gen_random_uuid();
  v_worksheet uuid := gen_random_uuid();
  v_first_command uuid := gen_random_uuid();
  v_failed_command uuid := gen_random_uuid();
  v_submit_command uuid := gen_random_uuid();
  v_version text := 'accelerated-l01-l16-ed73dee7';
  v_receipt record;
  v_function regprocedure;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.accelerated_commit_completion_workspace(uuid,text,uuid,jsonb,bigint,uuid,text,text,text,text,text,boolean)'::regprocedure,
    'public.accelerated_claim_completion_credential(uuid,text,text,text)'::regprocedure,
    'public.accelerated_change_completion_link(uuid,text,bigint,text,text)'::regprocedure
  ] LOOP
    IF has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_function, 'EXECUTE')
       OR EXISTS (
         SELECT 1 FROM pg_proc p,
           LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
         WHERE p.oid = v_function AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
       ) THEN
      RAISE EXCEPTION 'Completion function privilege boundary failed: %', v_function;
    END IF;
  END LOOP;

  INSERT INTO auth.users(id) VALUES (v_user);
  INSERT INTO public.accelerated_member_enrollments(user_id,content_version,claim_sha256)
    VALUES (v_user,v_version,repeat('a',64));
  INSERT INTO public.accelerated_member_worksheets(worksheet_id,user_id,content_version)
    VALUES (v_worksheet,v_user,v_version);

  SELECT * INTO v_receipt FROM public.accelerated_commit_completion_workspace(
    v_user,v_version,v_worksheet,'{"L01":"Before"}'::jsonb,0,v_first_command,
    'save',repeat('b',64),NULL,NULL,NULL,false
  );
  IF v_receipt.revision <> 1 OR v_receipt.replay OR v_receipt.intake_id IS NOT NULL THEN
    RAISE EXCEPTION 'First save receipt failed';
  END IF;
  SELECT * INTO v_receipt FROM public.accelerated_commit_completion_workspace(
    v_user,v_version,v_worksheet,'{"L01":"Before"}'::jsonb,0,v_first_command,
    'save',repeat('b',64),NULL,NULL,NULL,false
  );
  IF v_receipt.revision <> 1 OR NOT v_receipt.replay THEN
    RAISE EXCEPTION 'Exact command replay failed';
  END IF;
  IF (SELECT count(*) FROM public.accelerated_completion_commands WHERE user_id=v_user) <> 1 THEN
    RAISE EXCEPTION 'Replay created another command';
  END IF;

  BEGIN
    PERFORM public.accelerated_commit_completion_workspace(
      v_user,v_version,v_worksheet,'{"L01":"Different"}'::jsonb,0,v_first_command,
      'save',repeat('c',64),NULL,NULL,NULL,false
    );
    RAISE EXCEPTION 'Conflicting command unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  BEGIN
    PERFORM public.accelerated_commit_completion_workspace(
      v_user,v_version,v_worksheet,'{"L01":"Different"}'::jsonb,0,gen_random_uuid(),
      'save',repeat('c',64),NULL,NULL,NULL,false
    );
    RAISE EXCEPTION 'Stale revision unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;

  EXECUTE $ddl$CREATE FUNCTION pg_temp.fail_completion_command() RETURNS trigger
    LANGUAGE plpgsql AS $body$ BEGIN RAISE EXCEPTION 'Injected command failure' USING ERRCODE='P0001'; END $body$$ddl$;
  EXECUTE 'CREATE TRIGGER fail_completion_command BEFORE INSERT ON public.accelerated_completion_commands FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_completion_command()';
  BEGIN
    PERFORM public.accelerated_commit_completion_workspace(
      v_user,v_version,v_worksheet,'{"L01":"After"}'::jsonb,1,v_failed_command,
      'submit',repeat('d',64),repeat('e',64),'Synthetic Learner','synthetic@example.invalid',true
    );
    RAISE EXCEPTION 'Injected failure unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  EXECUTE 'DROP TRIGGER fail_completion_command ON public.accelerated_completion_commands';

  IF (SELECT answers FROM public.accelerated_member_worksheets WHERE worksheet_id=v_worksheet) <> '{"L01":"Before"}'::jsonb
     OR (SELECT revision FROM public.accelerated_member_enrollments WHERE user_id=v_user AND content_version=v_version) <> 1
     OR EXISTS (SELECT 1 FROM public.accelerated_completion_commands WHERE command_id=v_failed_command)
     OR EXISTS (SELECT 1 FROM public.accelerated_decision_file_intakes WHERE worksheet_id=v_worksheet)
     OR EXISTS (SELECT 1 FROM public.accelerated_decision_file_owners o JOIN public.accelerated_decision_file_intakes i ON i.id=o.intake_id WHERE i.worksheet_id=v_worksheet) THEN
    RAISE EXCEPTION 'Injected failure did not roll back worksheet, intake, owner, enrollment, and command';
  END IF;

  SELECT * INTO v_receipt FROM public.accelerated_commit_completion_workspace(
    v_user,v_version,v_worksheet,'{"L01":"After"}'::jsonb,1,v_submit_command,
    'submit',repeat('d',64),repeat('e',64),'Synthetic Learner','synthetic@example.invalid',true
  );
  IF v_receipt.revision <> 2 OR v_receipt.replay OR v_receipt.intake_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.accelerated_decision_file_owners WHERE intake_id=v_receipt.intake_id AND user_id=v_user)
     OR (SELECT count(*) FROM public.accelerated_completion_commands WHERE user_id=v_user) <> 2 THEN
    RAISE EXCEPTION 'Successful submission did not commit one bound receipt';
  END IF;
  RAISE NOTICE 'Completion transaction, replay, rollback, and role boundaries passed';
END $test$;

ROLLBACK;
