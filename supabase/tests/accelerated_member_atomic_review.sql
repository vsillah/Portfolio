-- Run as a single statement batch against staging. Every synthetic row is rolled back.
BEGIN;
INSERT INTO auth.users(id) VALUES ('44444444-4444-4444-8444-444444444444');
DO $test$
DECLARE
  v_state jsonb := '{"version":"accelerated-l01-l16-ed73dee7","worksheet":{"worksheetId":"55555555-5555-4555-8555-555555555555","answers":{"L01":"Synthetic test"}},"completed":["L01"],"videoSeconds":{"L01":90},"currentLessonId":"L02"}'::jsonb;
  v_revision bigint;
  v_replay boolean;
BEGIN
  SELECT revision,replay INTO v_revision,v_replay FROM public.accelerated_write_member_progress('44444444-4444-4444-8444-444444444444','accelerated-l01-l16-ed73dee7',v_state,'claim',0,repeat('a',64));
  IF v_revision <> 1 OR v_replay THEN RAISE EXCEPTION 'claim receipt failure'; END IF;
  SELECT revision,replay INTO v_revision,v_replay FROM public.accelerated_write_member_progress('44444444-4444-4444-8444-444444444444','accelerated-l01-l16-ed73dee7',v_state,'claim',0,repeat('a',64));
  IF v_revision <> 1 OR NOT v_replay THEN RAISE EXCEPTION 'claim replay failure'; END IF;
  BEGIN
    PERFORM public.accelerated_write_member_progress('44444444-4444-4444-8444-444444444444','accelerated-l01-l16-ed73dee7',v_state,'save',0,repeat('b',64));
    RAISE EXCEPTION 'stale write unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  IF (SELECT revision FROM public.accelerated_member_enrollments WHERE user_id='44444444-4444-4444-8444-444444444444') <> 1 THEN RAISE EXCEPTION 'stale write changed revision'; END IF;
  IF (SELECT count(*) FROM public.accelerated_member_worksheets WHERE user_id='44444444-4444-4444-8444-444444444444') <> 1 THEN RAISE EXCEPTION 'worksheet missing'; END IF;
  BEGIN
    PERFORM public.accelerated_write_member_progress('44444444-4444-4444-8444-444444444444','accelerated-l01-l16-ed73dee7',jsonb_set(v_state,'{worksheet,worksheetId}','"66666666-6666-4666-8666-666666666666"'::jsonb),'save',1,repeat('b',64));
    RAISE EXCEPTION 'worksheet identity switch unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  IF (SELECT count(*) FROM public.accelerated_member_worksheets WHERE user_id='44444444-4444-4444-8444-444444444444') <> 1 THEN RAISE EXCEPTION 'identity switch changed worksheet'; END IF;
  RAISE NOTICE 'synthetic claim/replay/stale/identity rollback checks passed';
END $test$;
INSERT INTO auth.users(id) VALUES ('77777777-7777-4777-8777-777777777777');
DO $review$
DECLARE
  v_contact bigint;
  v_other_contact bigint;
  v_audit bigint;
  v_other_audit bigint;
  v_intake uuid := '88888888-8888-4888-8888-888888888888';
  v_receipt record;
  v_offer text;
  v_recommendation uuid;
BEGIN
  INSERT INTO public.contact_submissions(name,email,is_test_data,lead_source) VALUES ('Synthetic Learner','synthetic@example.invalid',true,'website_form') RETURNING id INTO v_contact;
  INSERT INTO public.contact_submissions(name,email,is_test_data,lead_source) VALUES ('Different Learner','other@example.invalid',true,'website_form') RETURNING id INTO v_other_contact;
  INSERT INTO public.diagnostic_audits(audit_type,status,contact_submission_id,user_id) VALUES ('standalone','completed',v_contact,'44444444-4444-4444-8444-444444444444') RETURNING id INTO v_audit;
  INSERT INTO public.diagnostic_audits(audit_type,status,contact_submission_id,user_id) VALUES ('standalone','completed',v_other_contact,'77777777-7777-4777-8777-777777777777') RETURNING id INTO v_other_audit;
  INSERT INTO public.accelerated_decision_file_intakes(id,worksheet_id,content_version,payload_sha256,learner_name,learner_email,answers,consented_at)
    VALUES (v_intake,'99999999-9999-4999-8999-999999999999','accelerated-l01-l16-ed73dee7',repeat('c',64),'Synthetic Learner','synthetic@example.invalid','{"L01":"Synthetic review"}'::jsonb,now());
  SELECT * INTO v_receipt FROM public.accelerated_review_decision_file(v_intake,'linked','Verified synthetic audit',v_audit,'77777777-7777-4777-8777-777777777777');
  IF v_receipt.review_status <> 'linked' OR v_receipt.linked_audit_id <> v_audit THEN RAISE EXCEPTION 'review receipt failure'; END IF;
  IF (SELECT user_id FROM public.accelerated_decision_file_owners WHERE intake_id=v_intake) <> '44444444-4444-4444-8444-444444444444' THEN RAISE EXCEPTION 'ownership failure'; END IF;
  SELECT id::text INTO v_offer FROM public.services WHERE is_active ORDER BY id LIMIT 1;
  IF v_offer IS NULL THEN RAISE EXCEPTION 'staging catalog fixture missing'; END IF;
  SELECT public.accelerated_approve_member_recommendation(v_intake,v_audit,'service',v_offer,'Synthetic reviewed offer','Synthetic evidence match','77777777-7777-4777-8777-777777777777') INTO v_recommendation;
  IF (SELECT user_id FROM public.accelerated_member_recommendations WHERE id=v_recommendation AND review_status='approved' AND intake_id=v_intake AND audit_id=v_audit) <> '44444444-4444-4444-8444-444444444444' THEN RAISE EXCEPTION 'recommendation source failure'; END IF;
  BEGIN
    PERFORM public.accelerated_approve_member_recommendation(v_intake,v_other_audit,'service',v_offer,'Synthetic reviewed offer','Synthetic evidence match','77777777-7777-4777-8777-777777777777');
    RAISE EXCEPTION 'wrong-audit recommendation unexpectedly approved';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  BEGIN
    PERFORM public.accelerated_review_decision_file(v_intake,'linked','Wrong owner',v_other_audit,'77777777-7777-4777-8777-777777777777');
    RAISE EXCEPTION 'mismatched audit unexpectedly linked';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  IF (SELECT linked_audit_id FROM public.accelerated_decision_file_intakes WHERE id=v_intake) <> v_audit THEN RAISE EXCEPTION 'failed review changed audit'; END IF;
  RAISE NOTICE 'synthetic review/ownership rollback checks passed';
END $review$;
ROLLBACK;
