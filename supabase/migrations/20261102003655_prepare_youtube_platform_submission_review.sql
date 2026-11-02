-- Prepare one internal YouTube final-submission packet from immutable evidence.
-- No provider, platform draft, upload, scheduling, or publication action exists here.
CREATE FUNCTION public.prepare_youtube_platform_submission_review(
  p_social_content_id UUID,
  p_expected_content_updated_at TIMESTAMPTZ,
  p_privacy_decision_receipt_id UUID,
  p_content_version TEXT,
  p_master_sha256 TEXT,
  p_thumbnail_sha256 TEXT,
  p_thumbnail_direction TEXT,
  p_triggered_by_user_id UUID,
  p_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_item public.social_content_queue%ROWTYPE;
  v_privacy public.social_content_decision_receipts%ROWTYPE;
  v_packet JSONB;
  v_candidate JSONB;
  v_live_candidate JSONB;
  v_bundle JSONB;
  v_master JSONB;
  v_thumbnail JSONB;
  v_receipt public.dark_castle_prerequisite_receipts%ROWTYPE;
  v_key TEXT;
  v_seen TEXT[] := ARRAY[]::TEXT[];
  v_run_id UUID := gen_random_uuid();
  v_approval_id UUID := gen_random_uuid();
  v_work_item_id UUID := gen_random_uuid();
  -- The Social Content BEFORE UPDATE trigger assigns now() to updated_at.
  v_prepared_at TIMESTAMPTZ := now();
  v_persisted_at TIMESTAMPTZ;
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  -- The admin API verifies this user; service_role has no SELECT on auth.users.
  IF p_triggered_by_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated operator identity is required';
  END IF;
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Final review idempotency key is required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  SELECT * INTO v_item FROM public.social_content_queue
    WHERE id = p_social_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Social Content record missing'; END IF;
  IF v_item.platform IS DISTINCT FROM 'youtube'
     OR COALESCE(v_item.status, '') NOT IN ('draft','approved')
     OR v_item.rag_context ->> 'current_gate' IS DISTINCT FROM 'platform_submission'
     OR v_item.rag_context ->> 'latest_internal_decision_receipt_id'
        IS DISTINCT FROM p_privacy_decision_receipt_id::TEXT
     OR v_item.rag_context ->> 'latest_internal_decision' IS DISTINCT FROM 'approve'
     OR v_item.rag_context ->> 'latest_internal_decision_command' IS DISTINCT FROM 'approve_privacy'
     OR v_item.rag_context ->> 'content_version' IS DISTINCT FROM p_content_version THEN
    RAISE EXCEPTION 'Exact YouTube record, privacy decision, gate, and content version required';
  END IF;
  IF v_item.scheduled_for IS NOT NULL OR v_item.published_at IS NOT NULL
     OR v_item.platform_post_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.social_content_publishes WHERE content_id = p_social_content_id)
     OR v_item.rag_context -> 'platform_submission_gate' ->> 'status'
        IN ('approved','submitting','partially_submitted','submitted','published','uncertain','ambiguous') THEN
    RAISE EXCEPTION 'Provider or publication activity blocks internal review preparation';
  END IF;

  SELECT * INTO v_privacy FROM public.social_content_decision_receipts
    WHERE id = p_privacy_decision_receipt_id AND social_content_id = p_social_content_id
      AND current_gate = 'privacy' AND decision = 'approve'
      AND command_name = 'approve_privacy' AND next_internal_gate = 'platform_submission';
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact immutable privacy decision receipt required'; END IF;
  IF (SELECT count(*) FROM public.social_content_decision_receipts
      WHERE social_content_id = p_social_content_id AND current_gate = 'privacy'
        AND decision = 'approve' AND next_internal_gate = 'platform_submission') <> 1 THEN
    RAISE EXCEPTION 'Duplicate approved privacy decision identity';
  END IF;

  v_master := v_item.rag_context -> 'dark_castle_master_binding';
  v_thumbnail := v_item.rag_context -> 'dark_castle_thumbnail_binding';
  IF v_master ->> 'social_content_id' IS DISTINCT FROM p_social_content_id::TEXT
     OR v_master ->> 'content_version' IS DISTINCT FROM p_content_version
     OR v_master ->> 'sha256' IS DISTINCT FROM p_master_sha256
     OR v_master ->> 'path' IS DISTINCT FROM v_item.video_url
     OR v_thumbnail ->> 'social_content_id' IS DISTINCT FROM p_social_content_id::TEXT
     OR v_thumbnail ->> 'content_version' IS DISTINCT FROM p_content_version
     OR v_thumbnail ->> 'sha256' IS DISTINCT FROM p_thumbnail_sha256
     OR v_thumbnail ->> 'direction' IS DISTINCT FROM p_thumbnail_direction
     OR v_thumbnail ->> 'path' IS DISTINCT FROM v_item.image_url
     OR v_item.rag_context ->> 'approved_visual_sha256' IS DISTINCT FROM 'sha256:' || p_thumbnail_sha256
     OR p_master_sha256 !~ '^[0-9a-f]{64}$'
     OR p_thumbnail_sha256 !~ '^[0-9a-f]{64}$'
     OR NULLIF(BTRIM(p_thumbnail_direction), '') IS NULL THEN
    RAISE EXCEPTION 'Approved master, thumbnail, direction, or media binding mismatch';
  END IF;

  v_candidate := v_privacy.candidate_projection;
  v_live_candidate := jsonb_build_object(
    'post_text', v_item.post_text, 'cta_text', v_item.cta_text, 'cta_url', v_item.cta_url,
    'youtube_title', v_item.youtube_title, 'youtube_description', v_item.youtube_description,
    'video_url', v_item.video_url, 'media_sha256', p_master_sha256,
    'image_url', v_item.image_url, 'visual_sha256', 'sha256:' || p_thumbnail_sha256,
    'thumbnail_direction', p_thumbnail_direction,
    'thumbnail_selection_receipt_id', v_thumbnail ->> 'receipt_id',
    'description_receipt_id', v_master ->> 'description_receipt_id',
    'evidence_receipt_id', v_master ->> 'evidence_receipt_id');
  IF jsonb_typeof(v_candidate) IS DISTINCT FROM 'object'
     OR v_candidate IS DISTINCT FROM v_live_candidate
     OR v_candidate IS DISTINCT FROM v_item.rag_context -> 'copy_review_candidate_projection'
     OR v_master ->> 'description_receipt_id' IS DISTINCT FROM v_item.rag_context -> 'youtube_description_receipt' ->> 'receipt_id'
     OR v_master ->> 'evidence_receipt_id' IS DISTINCT FROM v_item.rag_context -> 'description_evidence_reconciliation_receipt' ->> 'receipt_id'
     OR v_thumbnail ->> 'receipt_id' IS NULL THEN
    RAISE EXCEPTION 'Current YouTube candidate projection or source identity drifted';
  END IF;

  v_bundle := v_privacy.receipt_bundle;
  IF jsonb_typeof(v_bundle) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Privacy decision receipt bundle missing';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['source','voice','framework','privacy','visual','challenger'] LOOP
    IF jsonb_typeof(v_bundle -> v_key) IS DISTINCT FROM 'object'
       OR NULLIF(BTRIM(v_bundle -> v_key ->> 'receipt_id'), '') IS NULL
       OR v_bundle -> v_key ->> 'status' IS DISTINCT FROM 'approved'
       OR v_bundle -> v_key ->> 'social_content_id' IS DISTINCT FROM p_social_content_id::TEXT
       OR v_bundle -> v_key ->> 'content_version' IS DISTINCT FROM p_content_version
       OR v_bundle -> v_key ->> 'receipt_id' = ANY(v_seen) THEN
      RAISE EXCEPTION 'Missing, pending, or duplicate % prerequisite identity', v_key;
    END IF;
    v_seen := array_append(v_seen, v_bundle -> v_key ->> 'receipt_id');
    SELECT * INTO v_receipt FROM public.dark_castle_prerequisite_receipts
      WHERE receipt_id = v_bundle -> v_key ->> 'receipt_id' AND kind = v_key
        AND social_content_id = p_social_content_id AND content_version = p_content_version;
    IF NOT FOUND OR v_receipt.receipt ->> 'receipt_id' IS DISTINCT FROM v_receipt.receipt_id
       OR v_receipt.receipt ->> 'status' IS DISTINCT FROM 'approved'
       OR v_receipt.artifact_hashes ->> 'master_sha256' IS DISTINCT FROM p_master_sha256
       OR v_receipt.artifact_hashes ->> 'thumbnail_sha256' IS DISTINCT FROM p_thumbnail_sha256
       OR v_receipt.receipt ->> 'packet_id' IS DISTINCT FROM v_receipt.packet_id
       OR v_receipt.receipt ->> 'evidence_fingerprint' IS DISTINCT FROM v_receipt.evidence_fingerprint
       OR v_bundle -> v_key ->> 'packet_id' IS DISTINCT FROM v_receipt.packet_id
       OR v_bundle -> v_key ->> 'evidence_fingerprint' IS DISTINCT FROM v_receipt.evidence_fingerprint
       OR (v_key = 'visual' AND (v_receipt.receipt ->> 'asset_sha256' IS DISTINCT FROM 'sha256:' || p_thumbnail_sha256
         OR v_receipt.receipt ->> 'asset_path' IS DISTINCT FROM v_item.image_url)) THEN
      RAISE EXCEPTION 'Immutable % prerequisite receipt mismatch', v_key;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.dark_castle_prerequisite_receipts
      WHERE social_content_id = p_social_content_id) <> 6 THEN
    RAISE EXCEPTION 'Exactly six unique immutable prerequisites required';
  END IF;

  v_packet := v_item.rag_context -> 'mobile_decision_review';
  IF v_packet ->> 'current_gate' = 'platform_submission' THEN
    IF v_packet ->> 'version' IS DISTINCT FROM 'social-content-decision-review/v1'
       OR v_packet ->> 'platform' IS DISTINCT FROM 'youtube'
       OR v_packet ->> 'content_id' IS DISTINCT FROM p_social_content_id::TEXT
       OR v_packet ->> 'content_version' IS DISTINCT FROM p_content_version
       OR v_packet ->> 'privacy_decision_receipt_id' IS DISTINCT FROM p_privacy_decision_receipt_id::TEXT
       OR v_packet ->> 'master_sha256' IS DISTINCT FROM p_master_sha256
       OR v_packet ->> 'thumbnail_sha256' IS DISTINCT FROM p_thumbnail_sha256
       OR v_packet ->> 'thumbnail_direction' IS DISTINCT FROM p_thumbnail_direction
       OR v_packet ->> 'idempotency_key' IS DISTINCT FROM p_idempotency_key
       OR (v_packet ->> 'prepared_from_content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM p_expected_content_updated_at
       OR (v_packet ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM v_item.updated_at
       OR v_packet -> 'source_receipts' IS DISTINCT FROM v_bundle
       OR v_packet -> 'receipts' IS DISTINCT FROM v_bundle
       OR v_packet -> 'candidate_projection' IS DISTINCT FROM v_candidate
       OR NOT EXISTS (SELECT 1 FROM public.agent_work_items w JOIN public.agent_approvals a ON a.id = w.approval_id
          JOIN public.agent_runs r ON r.id = w.active_run_id
          WHERE w.id::TEXT = v_packet ->> 'work_item_id' AND w.source_type = 'social_content_internal_review'
            AND w.source_id = p_social_content_id::TEXT AND w.idempotency_key = p_idempotency_key
            AND w.metadata -> 'review_packet' = v_packet AND w.status = 'ready_for_review'
            AND a.id::TEXT = v_packet ->> 'approval_id' AND a.run_id = r.id AND a.status = 'pending'
            AND r.id::TEXT = v_packet ->> 'run_id' AND r.triggered_by_user_id = p_triggered_by_user_id) THEN
      RAISE EXCEPTION 'Existing YouTube final packet is stale or identity mismatched';
    END IF;
    RETURN jsonb_build_object('work_item_id',v_packet ->> 'work_item_id','approval_id',v_packet ->> 'approval_id',
      'run_id',v_packet ->> 'run_id','content_updated_at',v_item.updated_at,
      'current_gate','platform_submission','next_gate','platform_submission',
      'idempotent_replay',true,'external_execution',false);
  END IF;
  IF v_packet IS NOT NULL AND v_packet ->> 'current_gate' IS DISTINCT FROM 'privacy' THEN
    RAISE EXCEPTION 'An unrelated Decision Queue packet already owns this record';
  END IF;
  IF v_item.updated_at IS DISTINCT FROM p_expected_content_updated_at THEN
    RAISE EXCEPTION 'Social Content version is stale';
  END IF;
  IF EXISTS (SELECT 1 FROM public.agent_work_items WHERE idempotency_key = p_idempotency_key
      OR (source_type = 'social_content_internal_review' AND source_id = p_social_content_id::TEXT
        AND metadata -> 'review_packet' ->> 'current_gate' = 'platform_submission')) THEN
    RAISE EXCEPTION 'Existing final review identity is not bound to the live packet';
  END IF;

  v_packet := jsonb_build_object(
    'version','social-content-decision-review/v1','platform','youtube',
    'approval_id',v_approval_id,'run_id',v_run_id,'work_item_id',v_work_item_id,
    'content_id',p_social_content_id,'content_version',p_content_version,
    'content_updated_at',v_prepared_at,'prepared_from_content_updated_at',p_expected_content_updated_at,
    'current_gate','platform_submission','next_gate','platform_submission',
    'privacy_decision_receipt_id',p_privacy_decision_receipt_id,
    'master_sha256',p_master_sha256,'thumbnail_sha256',p_thumbnail_sha256,
    'thumbnail_direction',p_thumbnail_direction,'media_binding',v_master,'thumbnail_binding',v_thumbnail,
    'candidate_projection',v_candidate,'source_receipts',v_bundle,'receipts',v_bundle,
    'idempotency_key',p_idempotency_key,'external_execution',false,
    'boundary','Internal Decision Queue review only. Provider calls, uploads, platform drafts, scheduling, publishing, and sends remain closed.');
  INSERT INTO public.agent_runs
    (id,agent_key,runtime,kind,title,status,subject_type,subject_id,subject_label,current_step,
     trigger_source,triggered_by_user_id,metadata,idempotency_key,updated_at)
  VALUES (v_run_id,'chief-of-staff','manual','social_content_review','YouTube final platform-submission review',
    'waiting_for_approval','social_content_internal_review',p_social_content_id::TEXT,'Social Content',
    'Awaiting canonical platform-submission decision','portfolio_operator',p_triggered_by_user_id,
    jsonb_build_object('review_packet',v_packet,'external_execution',false),p_idempotency_key || ':run',v_prepared_at);
  INSERT INTO public.agent_approvals (id,run_id,approval_type,status,requested_by_agent_key,metadata)
  VALUES (v_approval_id,v_run_id,'social_content_internal_review','pending','chief-of-staff',
    jsonb_build_object('review_packet',v_packet,'external_execution',false));
  INSERT INTO public.agent_work_items
    (id,title,objective,status,priority,owner_agent_key,owner_runtime,source_type,source_id,source_label,
     source_run_id,active_run_id,overlap_group,validation_summary,approval_id,metadata,idempotency_key,updated_at)
  VALUES (v_work_item_id,'Review final YouTube platform-submission packet',
    'Review exact approved YouTube media, privacy decision, candidate, and six immutable prerequisites.',
    'ready_for_review','high','chief-of-staff','manual','social_content_internal_review',p_social_content_id::TEXT,
    'Social Content',v_run_id,v_run_id,'social-content-review',
    'Version-bound internal review only; external execution remains disabled.',v_approval_id,
    jsonb_build_object('review_packet',v_packet,'external_execution',false),p_idempotency_key,v_prepared_at);
  UPDATE public.social_content_queue SET rag_context = rag_context || jsonb_build_object('mobile_decision_review',v_packet),
    updated_at = v_prepared_at WHERE id = p_social_content_id RETURNING updated_at INTO v_persisted_at;
  IF v_persisted_at IS DISTINCT FROM v_prepared_at THEN
    RAISE EXCEPTION 'Prepared packet timestamp changed; transaction rolled back';
  END IF;
  RETURN jsonb_build_object('work_item_id',v_work_item_id,'approval_id',v_approval_id,'run_id',v_run_id,
    'content_updated_at',v_persisted_at,'current_gate','platform_submission',
    'next_gate','platform_submission','idempotent_replay',false,'external_execution',false);
END; $$;

REVOKE ALL ON FUNCTION public.prepare_youtube_platform_submission_review(UUID,TIMESTAMPTZ,UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_youtube_platform_submission_review(UUID,TIMESTAMPTZ,UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT)
  TO service_role;
COMMENT ON FUNCTION public.prepare_youtube_platform_submission_review(UUID,TIMESTAMPTZ,UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT) IS
  'Prepare one version-bound internal YouTube final submission Decision Queue packet from immutable receipts; no external execution.';
