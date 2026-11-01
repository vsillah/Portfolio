CREATE OR REPLACE FUNCTION public.prepare_linkedin_platform_submission_review(
  p_social_content_id UUID,
  p_expected_content_updated_at TIMESTAMPTZ,
  p_handoff_decision_receipt_id UUID,
  p_triggered_by_user_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.social_content_queue%ROWTYPE;
  v_handoff_decision public.social_linkedin_handoff_decisions%ROWTYPE;
  v_handoff_work public.agent_work_items%ROWTYPE;
  v_existing_work public.agent_work_items%ROWTYPE;
  v_run_id UUID := gen_random_uuid();
  v_approval_id UUID := gen_random_uuid();
  v_work_item_id UUID := gen_random_uuid();
  v_packet JSONB;
  v_handoff JSONB;
  v_candidate JSONB;
  v_receipts JSONB;
  v_receipt JSONB;
  v_key TEXT;
  v_seen TEXT[] := ARRAY[]::TEXT[];
  v_prepared_at TIMESTAMPTZ;
BEGIN
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Platform-submission review idempotency key is required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  SELECT * INTO v_item FROM public.social_content_queue
  WHERE id = p_social_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Social Content item not found'; END IF;

  IF v_item.scheduled_for IS NOT NULL OR v_item.published_at IS NOT NULL
     OR v_item.platform_post_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.social_content_publishes WHERE content_id = p_social_content_id)
     OR v_item.rag_context -> 'platform_submission_gate' ->> 'status'
        IN ('approved','submitting','partially_submitted','submitted','published','uncertain','ambiguous') THEN
    RAISE EXCEPTION 'Existing provider or publication evidence blocks final review preparation';
  END IF;

  v_packet := v_item.rag_context -> 'mobile_decision_review';
  IF v_packet ->> 'current_gate' = 'platform_submission' THEN
    IF v_packet ->> 'content_id' IS DISTINCT FROM p_social_content_id::TEXT
       OR v_packet ->> 'prior_handoff_decision_receipt_id' IS DISTINCT FROM p_handoff_decision_receipt_id::TEXT
       OR (v_packet ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM v_item.updated_at
       OR (p_expected_content_updated_at IS DISTINCT FROM v_item.updated_at
           AND p_expected_content_updated_at IS DISTINCT FROM (v_packet ->> 'prepared_from_content_updated_at')::TIMESTAMPTZ)
       OR NOT EXISTS (
         SELECT 1 FROM public.agent_work_items w
         JOIN public.agent_approvals a ON a.id = w.approval_id
         WHERE w.id::TEXT = v_packet ->> 'work_item_id'
           AND w.source_type = 'social_content_internal_review'
           AND w.source_id = p_social_content_id::TEXT
           AND w.active_run_id::TEXT = v_packet ->> 'run_id'
           AND a.id::TEXT = v_packet ->> 'approval_id'
           AND a.run_id = w.active_run_id AND a.status = 'pending'
       ) THEN
      RAISE EXCEPTION 'Existing final review packet is stale or mismatched';
    END IF;
    RETURN jsonb_build_object(
      'work_item_id', v_packet ->> 'work_item_id',
      'approval_id', v_packet ->> 'approval_id',
      'run_id', v_packet ->> 'run_id',
      'content_updated_at', v_item.updated_at,
      'current_gate', 'platform_submission',
      'next_gate', 'platform_submission',
      'idempotent_replay', true,
      'external_execution', false
    );
  END IF;

  IF v_item.updated_at IS DISTINCT FROM p_expected_content_updated_at THEN
    RAISE EXCEPTION 'Social Content platform-submission preparation is stale';
  END IF;
  IF v_item.status IS DISTINCT FROM 'approved'
     OR v_item.platform IS DISTINCT FROM 'linkedin'
     OR v_item.rag_context ->> 'current_gate' IS DISTINCT FROM 'platform_submission'
     OR v_item.rag_context -> 'linkedin_handoff_review' ->> 'decision_receipt_id'
        IS DISTINCT FROM p_handoff_decision_receipt_id::TEXT
     OR v_item.rag_context -> 'linkedin_handoff_review' ->> 'decision' IS DISTINCT FROM 'approve'
     OR v_item.rag_context -> 'linkedin_handoff_review' ->> 'next_internal_gate'
        IS DISTINCT FROM 'final_platform_submission_readiness' THEN
    RAISE EXCEPTION 'Exact approved LinkedIn handoff is required';
  END IF;

  SELECT * INTO v_handoff_decision FROM public.social_linkedin_handoff_decisions
  WHERE id = p_handoff_decision_receipt_id
    AND social_content_id = p_social_content_id
    AND decision = 'approve';
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact immutable handoff decision receipt is required'; END IF;

  SELECT * INTO v_handoff_work FROM public.agent_work_items
  WHERE id = v_handoff_decision.work_item_id FOR UPDATE;
  v_handoff := v_item.rag_context -> 'linkedin_draft_handoff';
  IF NOT FOUND
     OR v_handoff_work.status IS DISTINCT FROM 'blocked'
     OR v_handoff_work.source_type IS DISTINCT FROM 'social_content_linkedin_draft_handoff'
     OR v_handoff_work.source_id IS DISTINCT FROM p_social_content_id::TEXT
     OR v_handoff_work.metadata ->> 'handoff_review_receipt_id' IS DISTINCT FROM p_handoff_decision_receipt_id::TEXT
     OR v_handoff_work.metadata -> 'draft_packet' IS DISTINCT FROM v_handoff_decision.handoff_packet
     OR v_handoff_decision.handoff_packet IS DISTINCT FROM (v_handoff - 'work_item')
     OR v_handoff -> 'work_item' ->> 'id' IS DISTINCT FROM v_handoff_work.id::TEXT THEN
    RAISE EXCEPTION 'LinkedIn handoff receipt, work item, or packet identity mismatch';
  END IF;

  v_candidate := v_handoff -> 'candidate_projection';
  v_receipts := v_handoff -> 'evidence_receipts';
  IF v_handoff ->> 'privacy_decision_receipt_id' IS DISTINCT FROM v_handoff_decision.privacy_receipt_id::TEXT
     OR v_handoff ->> 'post_text' IS DISTINCT FROM v_item.post_text
     OR v_handoff ->> 'cta_text' IS DISTINCT FROM v_item.cta_text
     OR v_handoff ->> 'cta_url' IS DISTINCT FROM v_item.cta_url
     OR v_handoff -> 'visual_asset' ->> 'image_url' IS DISTINCT FROM v_item.image_url
     OR v_handoff ->> 'approved_visual_sha256' IS DISTINCT FROM v_item.rag_context ->> 'approved_visual_sha256'
     OR v_candidate IS DISTINCT FROM v_item.rag_context -> 'copy_review_candidate_projection'
     OR v_candidate ->> 'visual_sha256' IS DISTINCT FROM v_handoff ->> 'approved_visual_sha256' THEN
    RAISE EXCEPTION 'Approved copy, CTA, visual, or candidate binding mismatch';
  END IF;
  IF jsonb_typeof(v_receipts) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Approved evidence receipt bundle is missing';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['source','voice','framework','privacy','visual','challenger'] LOOP
    v_receipt := v_receipts -> v_key;
    IF jsonb_typeof(v_receipt) IS DISTINCT FROM 'object'
       OR NULLIF(BTRIM(v_receipt ->> 'receipt_id'), '') IS NULL
       OR LOWER(COALESCE(v_receipt ->> 'status','')) NOT IN ('approved','passed','complete')
       OR v_receipt ->> 'receipt_id' = ANY(v_seen) THEN
      RAISE EXCEPTION 'Missing, pending, or duplicate % evidence receipt', v_key;
    END IF;
    v_seen := array_append(v_seen, v_receipt ->> 'receipt_id');
  END LOOP;

  SELECT * INTO v_existing_work FROM public.agent_work_items
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RAISE EXCEPTION 'Existing final review work item is not bound to the live packet'; END IF;

  UPDATE public.social_content_queue SET updated_at = clock_timestamp()
  WHERE id = p_social_content_id RETURNING updated_at INTO v_prepared_at;
  FOREACH v_key IN ARRAY ARRAY['source','voice','framework','privacy','visual','challenger'] LOOP
    v_receipts := jsonb_set(v_receipts, ARRAY[v_key,'content_updated_at'], to_jsonb(v_prepared_at));
  END LOOP;

  v_packet := jsonb_build_object(
    'version', 'social-content-decision-review/v1',
    'approval_id', v_approval_id, 'run_id', v_run_id, 'work_item_id', v_work_item_id,
    'content_id', p_social_content_id, 'content_updated_at', v_prepared_at,
    'prepared_from_content_updated_at', p_expected_content_updated_at,
    'current_gate', 'platform_submission', 'next_gate', 'platform_submission',
    'prior_handoff_decision_receipt_id', p_handoff_decision_receipt_id,
    'privacy_decision_receipt_id', v_handoff_decision.privacy_receipt_id,
    'handoff_packet', v_handoff_decision.handoff_packet,
    'receipts', v_receipts, 'source_receipts', v_handoff -> 'evidence_receipts',
    'candidate_projection', v_candidate,
    'visual_asset', jsonb_build_object('path', v_item.image_url, 'sha256', v_item.rag_context ->> 'approved_visual_sha256'),
    'external_execution', false,
    'boundary', 'Internal final platform-submission decision only. Provider calls, uploads, external drafts, scheduling, publishing, and sends remain closed.'
  );

  INSERT INTO public.agent_runs (
    id, agent_key, runtime, kind, title, status, subject_type, subject_id,
    subject_label, current_step, trigger_source, triggered_by_user_id,
    metadata, idempotency_key, updated_at
  ) VALUES (
    v_run_id, 'chief-of-staff', 'manual', 'social_content_review',
    'Social Content final platform-submission review', 'waiting_for_approval',
    'social_content_internal_review', p_social_content_id::TEXT, 'Social Content',
    'Awaiting canonical platform-submission decision', 'portfolio_operator', p_triggered_by_user_id,
    jsonb_build_object('review_packet', v_packet, 'external_execution', false),
    p_idempotency_key || ':run', v_prepared_at
  );
  INSERT INTO public.agent_approvals (
    id, run_id, approval_type, status, requested_by_agent_key, metadata
  ) VALUES (
    v_approval_id, v_run_id, 'social_content_internal_review', 'pending', 'chief-of-staff',
    jsonb_build_object('review_packet', v_packet, 'external_execution', false)
  );
  INSERT INTO public.agent_work_items (
    id, title, objective, status, priority, owner_agent_key, owner_runtime,
    source_type, source_id, source_label, source_run_id, active_run_id,
    overlap_group, validation_summary, approval_id, metadata, idempotency_key, updated_at
  ) VALUES (
    v_work_item_id, 'Review final LinkedIn platform-submission packet',
    'Review the exact approved LinkedIn handoff and record one canonical internal readiness decision.',
    'ready_for_review', 'high', 'chief-of-staff', 'manual',
    'social_content_internal_review', p_social_content_id::TEXT, 'Social Content',
    v_run_id, v_run_id, 'social-content-review',
    'Exact handoff, privacy, visual, candidate, and evidence identities are bound; external execution remains disabled.',
    v_approval_id, jsonb_build_object('review_packet', v_packet, 'external_execution', false),
    p_idempotency_key, v_prepared_at
  );
  UPDATE public.social_content_queue
  SET rag_context = COALESCE(rag_context, '{}'::JSONB)
      || jsonb_build_object('mobile_decision_review', v_packet),
      updated_at = v_prepared_at
  WHERE id = p_social_content_id;

  RETURN jsonb_build_object(
    'work_item_id', v_work_item_id, 'approval_id', v_approval_id, 'run_id', v_run_id,
    'content_updated_at', v_prepared_at, 'current_gate', 'platform_submission',
    'next_gate', 'platform_submission', 'idempotent_replay', false, 'external_execution', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_linkedin_platform_submission_review(UUID, TIMESTAMPTZ, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_linkedin_platform_submission_review(UUID, TIMESTAMPTZ, UUID, UUID, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.prepare_linkedin_platform_submission_review(UUID, TIMESTAMPTZ, UUID, UUID, TEXT) IS
  'Idempotently prepares an internal final LinkedIn platform-submission Decision Queue packet without external execution.';
