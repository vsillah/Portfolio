-- Synthetic, transactional validation. Run only after the migration is present.
BEGIN;
DO $test$
DECLARE
  v_reviewer uuid := '10000000-0000-4000-8000-000000000001';
  v_packet uuid := '10000000-0000-4000-8000-000000000002';
  v_original uuid := '10000000-0000-4000-8000-000000000003';
  v_calendar uuid := '10000000-0000-4000-8000-000000000004';
  v_social uuid := '10000000-0000-4000-8000-000000000005';
  v_version timestamptz := clock_timestamp();
  v_original_version timestamptz := clock_timestamp() - interval '1 day';
  v_content_version timestamptz := clock_timestamp() - interval '2 hours';
  v_candidate jsonb;
  v_freshness jsonb;
  v_pattern jsonb := '{"source_use_boundary":"Synthetic bounded claim","supported_claims":["Claim one"]}'::jsonb;
  v_claim_hash text := repeat('b',64);
  v_receipt jsonb;
  v_replay jsonb;
  v_copy_hash text := encode(extensions.digest(convert_to('Synthetic approved copy','UTF8'),'sha256'),'hex');
  v_key text := 'synthetic-evidence-repair-decision-key';
  v_failed boolean;
  v_new_packet uuid;
  v_new_version timestamptz;
  v_decision text;
  v_expected_status text;
BEGIN
  INSERT INTO auth.users(id) VALUES (v_reviewer);
  INSERT INTO public.user_profiles(id,role) VALUES (v_reviewer,'admin');
  INSERT INTO public.social_content_queue(id,post_text,updated_at) VALUES (v_social,'Synthetic approved copy',v_content_version);
  INSERT INTO public.social_content_calendar_items(id,social_content_id,title,scheduled_for,authorization_status,metadata)
    VALUES (v_calendar,v_social,'Synthetic evidence repair review',v_version + interval '7 days','authorized','{"external_execution_enabled":false}');
  INSERT INTO public.social_content_research_packets(id,status,updated_at,source_url,platform)
    VALUES (v_original,'approved',v_original_version,'https://example.test/original','other');
  v_candidate := jsonb_build_object(
    'calendar_item_id',v_calendar,'social_content_id',v_social,
    'original_packet_id',v_original,'original_packet_version',v_original_version,
    'original_source_url','https://example.test/original',
    'candidate_status','human_qa_pending','linkage_status','unlinked',
    'preparation_rerun_status','not_run','external_actions_allowed',false,
    'approved_social_copy_unchanged',true,'approved_social_copy_sha256',v_copy_hash);
  v_freshness := jsonb_build_object('status','passed','source_url','https://example.test/replacement',
    'source_sha256',repeat('a',64),'evidence_version',v_version,
    'observed_at',v_version - interval '1 minute','expires_at',v_version + interval '1 day',
    'provenance_status','verified_primary_source',
    'privacy_clearance',jsonb_build_object('status','cleared'),
    'rights_clearance',jsonb_build_object('status','cleared_for_bounded_claim_support'));
  INSERT INTO public.social_content_research_packets(id,status,updated_at,source_url,platform,pattern_packet,actor_metadata)
    VALUES (v_packet,'review_ready',v_version,'https://example.test/replacement','other',v_pattern,
      jsonb_build_object('evidence_repair_candidate',v_candidate,'source_freshness_receipt',v_freshness));

  v_receipt := public.record_evidence_repair_human_qa_decision(v_packet,v_version,v_candidate,v_freshness,v_pattern,v_claim_hash,v_content_version,
    'approve','Synthetic source and bounded claim reviewed',v_reviewer,'portfolio',v_key);
  IF v_receipt->>'decision' <> 'approve' OR v_receipt->>'replayed' <> 'false'
    OR v_receipt->>'claim_boundary_sha256' <> v_claim_hash
    OR (v_receipt->>'content_version')::timestamptz <> v_content_version
    OR v_receipt->>'external_execution_enabled' <> 'false' THEN
    RAISE EXCEPTION 'approval receipt failed';
  END IF;
  IF (SELECT actor_metadata#>>'{evidence_repair_candidate,candidate_status}'
      FROM public.social_content_research_packets WHERE id=v_packet) <> 'human_qa_approved'
    OR (SELECT status FROM public.social_content_research_packets WHERE id=v_original) <> 'approved'
    OR (SELECT post_text FROM public.social_content_queue WHERE id=v_social) <> 'Synthetic approved copy'
    OR (SELECT count(*) FROM public.evidence_repair_human_qa_receipts WHERE packet_id=v_packet) <> 1 THEN
    RAISE EXCEPTION 'scope or immutable receipt failed';
  END IF;
  v_replay := public.record_evidence_repair_human_qa_decision(v_packet,v_version,v_candidate,v_freshness,v_pattern,v_claim_hash,v_content_version,
    'approve','Synthetic source and bounded claim reviewed',v_reviewer,'portfolio',v_key);
  IF v_replay->>'replayed' <> 'true' OR v_replay->>'id' <> v_receipt->>'id' THEN
    RAISE EXCEPTION 'exact replay failed';
  END IF;
  v_failed := false;
  BEGIN
    PERFORM public.record_evidence_repair_human_qa_decision(v_packet,v_version,v_candidate,v_freshness,v_pattern,v_claim_hash,v_content_version,
      'reject','Conflicting decision',v_reviewer,'portfolio','synthetic-conflicting-key');
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'conflict unexpectedly succeeded'; END IF;
  v_failed := false;
  BEGIN
    UPDATE public.evidence_repair_human_qa_receipts SET reason='changed' WHERE id=(v_receipt->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'receipt mutation unexpectedly succeeded'; END IF;

  -- Negative probes use separate version-bound packets, leaving decision packets untouched.
  v_new_packet := gen_random_uuid(); v_new_version := clock_timestamp();
  v_freshness := jsonb_set(v_freshness,'{evidence_version}',to_jsonb(v_new_version));
  INSERT INTO public.social_content_research_packets(id,status,updated_at,source_url,platform,pattern_packet,actor_metadata)
    VALUES (v_new_packet,'review_ready',v_new_version,'https://example.test/replacement','other',v_pattern,
      jsonb_build_object('evidence_repair_candidate',v_candidate,'source_freshness_receipt',v_freshness));
  v_failed := false;
  BEGIN
    PERFORM public.record_evidence_repair_human_qa_decision(v_new_packet,v_new_version,v_candidate,v_freshness,v_pattern,v_claim_hash,v_content_version + interval '1 second',
      'approve','Stale Social Content version',v_reviewer,'portfolio','synthetic-stale-content-version');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'evidence repair original, calendar, or approved copy changed' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'stale content version unexpectedly succeeded'; END IF;
  IF EXISTS (SELECT 1 FROM public.evidence_repair_human_qa_receipts WHERE packet_id=v_new_packet) THEN
    RAISE EXCEPTION 'stale content created a receipt';
  END IF;

  v_new_packet := gen_random_uuid(); v_new_version := clock_timestamp();
  v_freshness := jsonb_set(v_freshness,'{evidence_version}',to_jsonb(v_new_version));
  INSERT INTO public.social_content_research_packets(id,status,updated_at,source_url,platform,pattern_packet,actor_metadata)
    VALUES (v_new_packet,'review_ready',v_new_version,'https://example.test/replacement','other',
      jsonb_set(v_pattern,'{source_use_boundary}','"changed"'::jsonb),
      jsonb_build_object('evidence_repair_candidate',v_candidate,'source_freshness_receipt',v_freshness));
  v_failed := false;
  BEGIN
    PERFORM public.record_evidence_repair_human_qa_decision(v_new_packet,v_new_version,v_candidate,v_freshness,v_pattern,v_claim_hash,v_content_version,
      'approve','Changed claim boundary',v_reviewer,'portfolio','synthetic-changed-claim-boundary');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'evidence repair packet version or evidence changed' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'changed claim boundary unexpectedly succeeded'; END IF;
  IF EXISTS (SELECT 1 FROM public.evidence_repair_human_qa_receipts WHERE packet_id=v_new_packet) THEN
    RAISE EXCEPTION 'changed claim boundary created a receipt';
  END IF;

  FOREACH v_decision IN ARRAY ARRAY['reject','revise'] LOOP
    v_new_packet := gen_random_uuid(); v_new_version := clock_timestamp();
    v_freshness := jsonb_set(v_freshness,'{evidence_version}',to_jsonb(v_new_version));
    INSERT INTO public.social_content_research_packets(id,status,updated_at,source_url,platform,pattern_packet,actor_metadata)
      VALUES (v_new_packet,'review_ready',v_new_version,'https://example.test/replacement','other',v_pattern,
        jsonb_build_object('evidence_repair_candidate',v_candidate,'source_freshness_receipt',v_freshness));
    v_receipt := public.record_evidence_repair_human_qa_decision(v_new_packet,v_new_version,v_candidate,v_freshness,v_pattern,v_claim_hash,v_content_version,
      v_decision,'Synthetic actionable reason',v_reviewer,'portfolio','synthetic-'||v_decision||'-key');
    v_expected_status := CASE v_decision WHEN 'reject' THEN 'human_qa_rejected' ELSE 'revision_requested' END;
    IF v_receipt->>'decision' <> v_decision OR
      (SELECT actor_metadata#>>'{evidence_repair_candidate,candidate_status}'
       FROM public.social_content_research_packets WHERE id=v_new_packet) <> v_expected_status THEN
      RAISE EXCEPTION '% decision transition failed', v_decision;
    END IF;
  END LOOP;

  v_new_packet := gen_random_uuid(); v_new_version := clock_timestamp();
  v_freshness := jsonb_set(v_freshness,'{evidence_version}',to_jsonb(v_new_version)) - 'observed_at';
  INSERT INTO public.social_content_research_packets(id,status,updated_at,source_url,platform,pattern_packet,actor_metadata)
    VALUES (v_new_packet,'review_ready',v_new_version,'https://example.test/replacement','other',v_pattern,
      jsonb_build_object('evidence_repair_candidate',v_candidate,'source_freshness_receipt',v_freshness));
  v_failed := false;
  BEGIN
    PERFORM public.record_evidence_repair_human_qa_decision(v_new_packet,v_new_version,v_candidate,v_freshness,v_pattern,v_claim_hash,v_content_version,
      'approve','Missing observation must fail',v_reviewer,'portfolio','synthetic-missing-observation');
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'missing freshness observation unexpectedly succeeded'; END IF;
  IF EXISTS (SELECT 1 FROM public.evidence_repair_human_qa_receipts WHERE packet_id=v_new_packet) THEN
    RAISE EXCEPTION 'failed freshness created a receipt';
  END IF;
  RAISE NOTICE 'evidence repair approve, reject, revise, replay, conflict, freshness and scope checks passed';
END $test$;
ROLLBACK;
