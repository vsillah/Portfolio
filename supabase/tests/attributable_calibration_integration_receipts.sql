-- Synthetic fixture only. Every row and receipt is rolled back.
BEGIN;
DO $test$
DECLARE
  v_run uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_approval uuid := gen_random_uuid();
  v_receipt jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_bad jsonb;
  v_failed boolean;
  v_other uuid;
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.attributable_calibration_integration_receipts'::regclass AND relrowsecurity)
    OR has_table_privilege('anon', 'public.attributable_calibration_integration_receipts', 'SELECT')
    OR has_table_privilege('authenticated', 'public.attributable_calibration_integration_receipts', 'INSERT')
    OR has_table_privilege('service_role', 'public.attributable_calibration_integration_receipts', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.attributable_calibration_integration_receipts', 'SELECT')
    OR has_function_privilege('anon', 'public.record_attributable_calibration_integration_receipt(uuid,jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.record_attributable_calibration_integration_receipt(uuid,jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.record_attributable_calibration_integration_receipt(uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'RLS or role grants are wrong';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE oid = 'public.record_attributable_calibration_integration_receipt(uuid,jsonb)'::regprocedure
      AND prosecdef AND 'search_path=""' = ANY(proconfig)
  ) THEN RAISE EXCEPTION 'definer search_path is unsafe'; END IF;

  INSERT INTO auth.users(id) VALUES (v_user);
  INSERT INTO public.agent_runs(id, runtime, kind, title) VALUES (v_run, 'manual', 'synthetic_test', 'Synthetic calibration authority');
  v_receipt := jsonb_build_object(
    'decision_receipt_id', gen_random_uuid(), 'authority_id', v_approval,
    'authority_version', 'v1', 'decision', 'allow_synthetic_review_candidate',
    'report_sha256', repeat('a',64), 'policy_id', 'synthetic-policy',
    'policy_version', 'v1', 'policy_approval_receipt_id', gen_random_uuid(),
    'case_id', 'synthetic-case', 'artifact_version', 'v1',
    'evidence_version', 'v1', 'content_version', 'v1',
    'platform', 'youtube', 'channel', 'youtube', 'format', 'short',
    'cohort_receipt_sha256', repeat('b',64),
    'performance_receipt_sha256', repeat('c',64),
    'source_sha256', repeat('d',64), 'repair_binding_hash', repeat('e',64),
    'decided_at', clock_timestamp() - interval '1 minute',
    'valid_until', clock_timestamp() + interval '1 hour',
    'privacy_cleared', true, 'rights_cleared', true,
    'exclusions', jsonb_build_array('live data', 'external execution'),
    'source_path', 'synthetic/source.json',
    'provenance', jsonb_build_object('source_path','synthetic/source.json', 'kind','synthetic'),
    'rollback', 'Revoke this recording function; retain existing audit rows.',
    'receipt_sha256', repeat('f',64));
  INSERT INTO public.agent_approvals(id, run_id, approval_type, status,
    decided_by_user_id, decided_at, metadata)
  VALUES (v_approval, v_run, 'attributable_calibration_integration', 'approved',
    v_user, (v_receipt->>'decided_at')::timestamptz,
    jsonb_build_object('calibration_integration_authority',v_receipt));

  v_result := public.record_attributable_calibration_integration_receipt(v_approval, v_receipt);
  IF v_result->>'replayed' <> 'false' OR v_result->>'agent_approval_id' <> v_approval::text
    OR v_result->>'decision' <> 'allow_synthetic_review_candidate'
    OR (SELECT count(*) FROM public.attributable_calibration_integration_receipts WHERE agent_approval_id=v_approval) <> 1 THEN
    RAISE EXCEPTION 'valid insert failed';
  END IF;
  v_replay := public.record_attributable_calibration_integration_receipt(v_approval, v_receipt);
  IF v_replay->>'replayed' <> 'true' OR v_replay->>'id' <> v_result->>'id' THEN
    RAISE EXCEPTION 'exact replay failed';
  END IF;

  v_bad := jsonb_set(v_receipt, '{case_id}', '"changed"'::jsonb);
  v_failed := false;
  BEGIN PERFORM public.record_attributable_calibration_integration_receipt(v_approval,v_bad);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'conflicting replay succeeded'; END IF;
  v_failed := false;
  BEGIN UPDATE public.attributable_calibration_integration_receipts SET case_id='changed' WHERE id=(v_result->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'UPDATE succeeded'; END IF;
  v_failed := false;
  BEGIN DELETE FROM public.attributable_calibration_integration_receipts WHERE id=(v_result->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'DELETE succeeded'; END IF;

  -- Mutate only the synthetic parent and restore it after each negative probe.
  UPDATE public.agent_approvals SET approval_type='other' WHERE id=v_approval;
  v_failed := false;
  BEGIN PERFORM public.record_attributable_calibration_integration_receipt(v_approval,v_receipt);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'wrong approval type succeeded'; END IF;
  UPDATE public.agent_approvals SET approval_type='attributable_calibration_integration', status='pending' WHERE id=v_approval;
  v_failed := false;
  BEGIN PERFORM public.record_attributable_calibration_integration_receipt(v_approval,v_receipt);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'unapproved parent succeeded'; END IF;
  UPDATE public.agent_approvals SET status='approved' WHERE id=v_approval;

  FOR v_key IN SELECT unnest(ARRAY['decision','valid_until','report_sha256','policy_id',
    'case_id','artifact_version','evidence_version','content_version','channel','format',
    'cohort_receipt_sha256','performance_receipt_sha256','source_sha256',
    'repair_binding_hash','authority_version','privacy_cleared','rights_cleared',
    'exclusions','provenance','rollback']) LOOP
    v_bad := v_receipt - v_key;
    v_failed := false;
    BEGIN PERFORM public.record_attributable_calibration_integration_receipt(v_approval,v_bad);
    EXCEPTION WHEN OTHERS THEN v_failed := true; END;
    IF NOT v_failed THEN RAISE EXCEPTION 'missing % succeeded', v_key; END IF;
  END LOOP;
  v_bad := jsonb_set(v_receipt,'{decision}','"approve"'::jsonb);
  UPDATE public.agent_approvals SET metadata=jsonb_build_object('calibration_integration_authority',v_bad) WHERE id=v_approval;
  v_failed := false;
  BEGIN PERFORM public.record_attributable_calibration_integration_receipt(v_approval,v_bad);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'wrong decision succeeded'; END IF;
  v_bad := jsonb_set(v_receipt,'{valid_until}',to_jsonb(clock_timestamp() - interval '1 second'));
  UPDATE public.agent_approvals SET metadata=jsonb_build_object('calibration_integration_authority',v_bad) WHERE id=v_approval;
  v_failed := false;
  BEGIN PERFORM public.record_attributable_calibration_integration_receipt(v_approval,v_bad);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'expired receipt succeeded'; END IF;

  -- A different approved parent cannot claim the already-bound report/case.
  v_other := gen_random_uuid();
  v_bad := jsonb_set(v_receipt,'{authority_id}',to_jsonb(v_other));
  v_bad := jsonb_set(v_bad,'{decision_receipt_id}',to_jsonb(gen_random_uuid()));
  INSERT INTO public.agent_approvals(id, run_id, approval_type, status,
    decided_by_user_id, decided_at, metadata)
  VALUES (v_other, v_run, 'attributable_calibration_integration', 'approved',
    v_user, (v_bad->>'decided_at')::timestamptz,
    jsonb_build_object('calibration_integration_authority',v_bad));
  v_failed := false;
  BEGIN PERFORM public.record_attributable_calibration_integration_receipt(v_other,v_bad);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'duplicate case/version succeeded'; END IF;

  UPDATE public.agent_approvals SET metadata=jsonb_build_object('calibration_integration_authority',v_receipt) WHERE id=v_approval;
  v_other := gen_random_uuid();
  v_bad := jsonb_set(v_receipt,'{decision_receipt_id}',to_jsonb(v_other));
  UPDATE public.agent_approvals SET metadata=jsonb_build_object('calibration_integration_authority',v_bad) WHERE id=v_approval;
  v_failed := false;
  BEGIN PERFORM public.record_attributable_calibration_integration_receipt(v_approval,v_bad);
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'duplicate approval receipt succeeded'; END IF;
  IF (SELECT count(*) FROM public.attributable_calibration_integration_receipts WHERE agent_approval_id=v_approval) <> 1 THEN
    RAISE EXCEPTION 'negative probes wrote another receipt';
  END IF;
  RAISE NOTICE 'calibration authority insert, replay, conflict, parent, expiry, bindings, grants, RLS, immutability passed';
END $test$;
ROLLBACK;
