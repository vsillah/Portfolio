-- Extend the receipt-backed stage command to visual_review -> asset_packet.
-- Preparation only creates internal review records; it never approves visuals
-- or changes copy, CTA, media, candidate projection, or external authority.

CREATE OR REPLACE FUNCTION public.prepare_social_content_stage_review(
  p_social_content_id UUID,
  p_expected_content_updated_at TIMESTAMPTZ,
  p_current_gate TEXT,
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
  v_prior_receipt public.social_content_decision_receipts%ROWTYPE;
  v_existing_work public.agent_work_items%ROWTYPE;
  v_run_id UUID := gen_random_uuid();
  v_approval_id UUID := gen_random_uuid();
  v_work_item_id UUID := gen_random_uuid();
  v_next_gate TEXT;
  v_now TIMESTAMPTZ := now();
  v_receipts JSONB;
  v_candidate_projection JSONB;
  v_packet JSONB;
  v_key TEXT;
  v_receipt JSONB;
  v_seen_receipt_ids TEXT[] := ARRAY[]::TEXT[];
  v_source_version TIMESTAMPTZ;
  v_input_version TIMESTAMPTZ;
  v_prepared_version TIMESTAMPTZ;
  v_asset_hash TEXT;
  v_asset_path TEXT;
  v_lead_magnet JSONB;
BEGIN
  IF p_current_gate NOT IN ('visual_review', 'asset_packet', 'privacy') THEN
    RAISE EXCEPTION 'Unsupported Social Content review stage';
  END IF;
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Review preparation idempotency key is required';
  END IF;

  -- Serialize retries before checking the unique idempotency key so concurrent
  -- operator clicks resolve to one packet instead of one success and one error.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  SELECT * INTO v_item
  FROM public.social_content_queue
  WHERE id = p_social_content_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Social Content item not found'; END IF;
  IF (v_item.rag_context ->> 'current_gate') IS DISTINCT FROM p_current_gate THEN
    RAISE EXCEPTION 'Social Content current gate does not match requested stage';
  END IF;

  -- A retry after preparation sees the new row version and therefore a new
  -- request key. Reuse only the exact live packet bound to this item.
  v_packet := v_item.rag_context -> 'mobile_decision_review';
  IF v_packet ->> 'current_gate' = p_current_gate
     AND (v_packet ->> 'content_updated_at')::TIMESTAMPTZ = v_item.updated_at THEN
    IF p_expected_content_updated_at IS DISTINCT FROM v_item.updated_at
       AND p_expected_content_updated_at IS DISTINCT FROM (v_packet ->> 'prepared_from_content_updated_at')::TIMESTAMPTZ THEN
      RAISE EXCEPTION 'Social Content stage preparation is stale';
    END IF;
    IF v_packet ->> 'content_id' IS DISTINCT FROM p_social_content_id::TEXT
       OR NOT EXISTS (SELECT 1 FROM public.agent_work_items w
                      JOIN public.agent_approvals a ON a.id = w.approval_id
                      WHERE w.id::TEXT = v_packet ->> 'work_item_id'
                        AND w.source_id = p_social_content_id::TEXT
                        AND w.active_run_id::TEXT = v_packet ->> 'run_id'
                        AND a.id::TEXT = v_packet ->> 'approval_id'
                        AND a.status = 'pending') THEN
      RAISE EXCEPTION 'Existing review packet identity or version mismatch';
    END IF;
    RETURN jsonb_build_object(
      'work_item_id', v_packet ->> 'work_item_id',
      'approval_id', v_packet ->> 'approval_id',
      'run_id', v_packet ->> 'run_id',
      'content_updated_at', v_item.updated_at,
      'current_gate', p_current_gate,
      'next_gate', v_packet ->> 'next_gate',
      'idempotent_replay', true,
      'external_execution', false
    );
  END IF;
  IF v_packet ->> 'current_gate' = p_current_gate THEN
    RAISE EXCEPTION 'Existing review packet is stale';
  END IF;
  IF v_item.updated_at IS DISTINCT FROM p_expected_content_updated_at THEN
    RAISE EXCEPTION 'Social Content stage preparation is stale';
  END IF;

  SELECT * INTO v_existing_work
  FROM public.agent_work_items
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing_work.source_type IS DISTINCT FROM 'social_content_internal_review'
       OR v_existing_work.source_id IS DISTINCT FROM p_social_content_id::TEXT
       OR v_existing_work.metadata -> 'review_packet' ->> 'current_gate' IS DISTINCT FROM p_current_gate
       OR v_existing_work.metadata -> 'review_packet' ->> 'content_id' IS DISTINCT FROM p_social_content_id::TEXT
       OR (v_existing_work.metadata -> 'review_packet' ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM v_item.updated_at
       OR v_item.rag_context -> 'mobile_decision_review' ->> 'work_item_id' IS DISTINCT FROM v_existing_work.id::TEXT
       OR NOT EXISTS (SELECT 1 FROM public.agent_approvals a
                      WHERE a.id = v_existing_work.approval_id
                        AND a.run_id = v_existing_work.active_run_id
                        AND a.status = 'pending') THEN
      RAISE EXCEPTION 'Existing review packet identity or version mismatch';
    END IF;
    RETURN jsonb_build_object(
      'work_item_id', v_existing_work.id,
      'approval_id', v_existing_work.approval_id,
      'run_id', v_existing_work.active_run_id,
      'current_gate', p_current_gate,
      'idempotent_replay', true,
      'external_execution', false
    );
  END IF;

  SELECT * INTO v_prior_receipt
  FROM public.social_content_decision_receipts
  WHERE id::TEXT = v_item.rag_context ->> 'latest_internal_decision_receipt_id'
    AND social_content_id = p_social_content_id
    AND decision = 'approve'
    AND next_internal_gate = p_current_gate;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact approved prior-stage decision receipt is required';
  END IF;
  IF p_current_gate = 'visual_review'
     AND (v_prior_receipt.current_gate NOT IN ('copy', 'copy_review')
          OR v_prior_receipt.command_name IS DISTINCT FROM 'approve_copy'
          OR v_item.rag_context ->> 'latest_internal_decision' IS DISTINCT FROM 'approve') THEN
    RAISE EXCEPTION 'Exact approved prior copy decision receipt is required';
  END IF;

  v_receipts := v_prior_receipt.receipt_bundle;
  IF jsonb_typeof(v_receipts) <> 'object' THEN
    RAISE EXCEPTION 'Prior-stage receipt bundle is missing';
  END IF;
  v_source_version := v_prior_receipt.content_updated_at;
  v_input_version := v_item.updated_at;
  FOREACH v_key IN ARRAY ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']
  LOOP
    v_receipt := v_receipts -> v_key;
    IF jsonb_typeof(v_receipt) IS DISTINCT FROM 'object'
       OR NULLIF(BTRIM(v_receipt ->> 'receipt_id'), '') IS NULL
       OR LOWER(COALESCE(v_receipt ->> 'status', '')) NOT IN ('approved', 'passed', 'complete')
       OR NULLIF(v_receipt ->> 'content_updated_at', '') IS NULL
       OR (v_receipt ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM v_source_version THEN
      RAISE EXCEPTION 'Prior-stage % receipt is missing, pending, malformed, or stale', v_key;
    END IF;
    IF v_receipt ->> 'receipt_id' = ANY(v_seen_receipt_ids) THEN
      RAISE EXCEPTION 'Duplicate or ambiguous prior-stage receipt identity for %', v_key;
    END IF;
    v_seen_receipt_ids := array_append(v_seen_receipt_ids, v_receipt ->> 'receipt_id');
  END LOOP;

  v_next_gate := CASE p_current_gate
    WHEN 'visual_review' THEN 'asset_packet'
    WHEN 'asset_packet' THEN 'privacy'
    WHEN 'privacy' THEN 'platform_submission'
  END;
  v_candidate_projection := COALESCE(v_prior_receipt.candidate_projection, '{}'::JSONB);
  IF p_current_gate = 'visual_review'
     AND jsonb_typeof(v_prior_receipt.candidate_projection) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Current candidate projection is required';
  END IF;

  IF p_current_gate = 'visual_review' THEN
    -- Bind the approved visual receipt from the exact copy decision to the
    -- current candidate and exact asset. This command creates no visual decision.
    IF v_receipts -> 'visual' ->> 'status' IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'An approved visual receipt is required';
    END IF;
    v_asset_hash := v_candidate_projection ->> 'visual_sha256';
    v_asset_path := v_candidate_projection ->> 'image_url';
    IF v_candidate_projection IS DISTINCT FROM v_item.rag_context -> 'copy_review_candidate_projection'
       OR v_candidate_projection ->> 'post_text' IS DISTINCT FROM v_item.post_text
       OR v_candidate_projection ->> 'cta_text' IS DISTINCT FROM v_item.cta_text
       OR v_candidate_projection ->> 'cta_url' IS DISTINCT FROM v_item.cta_url
       OR v_asset_path IS DISTINCT FROM v_item.image_url
       OR v_asset_hash IS DISTINCT FROM v_item.rag_context ->> 'approved_visual_sha256' THEN
      RAISE EXCEPTION 'Current copy, CTA, visual, or candidate projection identity mismatch';
    END IF;
    IF v_asset_hash IS NULL OR v_asset_hash !~ '^sha256:[a-f0-9]{64}$'
       OR v_asset_path IS NULL OR NULLIF(BTRIM(v_asset_path), '') IS NULL
       OR v_asset_path !~ '^(/[^/]|https://[^/]+/)'
       OR v_asset_path ~ '[[:space:]?#]'
       OR v_asset_path LIKE '%..%' THEN
      RAISE EXCEPTION 'Safe exact visual asset hash and path are required';
    END IF;
    IF (v_receipts -> 'visual' ->> 'receipt_id') NOT LIKE '%' || v_asset_hash
       AND (v_receipts -> 'visual' ->> 'asset_sha256') IS DISTINCT FROM v_asset_hash THEN
      RAISE EXCEPTION 'Approved visual receipt is not bound to the exact asset hash';
    END IF;
    IF v_receipts -> 'visual' ? 'asset_path'
       AND v_receipts -> 'visual' ->> 'asset_path' IS DISTINCT FROM v_asset_path THEN
      RAISE EXCEPTION 'Approved visual receipt is not bound to the exact asset path';
    END IF;
    v_lead_magnet := v_item.rag_context -> 'lead_magnet_receipt';
    IF v_candidate_projection ? 'lead_magnet_receipt_id' THEN
      IF jsonb_typeof(v_lead_magnet) IS DISTINCT FROM 'object'
         OR v_lead_magnet ->> 'receipt_id' IS DISTINCT FROM v_candidate_projection ->> 'lead_magnet_receipt_id'
         OR v_lead_magnet ->> 'status' IS DISTINCT FROM 'approved'
         OR v_lead_magnet ->> 'url' IS DISTINCT FROM v_item.cta_url THEN
        RAISE EXCEPTION 'Lead-magnet receipt identity or URL mismatch';
      END IF;
    END IF;
    IF v_candidate_projection ? 'artifact_evidence_manifest'
       AND v_candidate_projection -> 'artifact_evidence_manifest' IS DISTINCT FROM v_item.rag_context -> 'artifact_evidence_manifest' THEN
      RAISE EXCEPTION 'Artifact lineage does not match the current candidate';
    END IF;
  END IF;

  -- The row trigger determines the exact review version. The second update
  -- must retain that version or this transaction rolls back.
  UPDATE public.social_content_queue SET updated_at = now()
  WHERE id = p_social_content_id
  RETURNING updated_at INTO v_prepared_version;
  IF v_prepared_version <= v_source_version THEN
    RAISE EXCEPTION 'Social Content version did not advance during packet preparation';
  END IF;
  v_now := v_prepared_version;
  FOREACH v_key IN ARRAY ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'] LOOP
    v_receipts := jsonb_set(v_receipts, ARRAY[v_key, 'content_updated_at'], to_jsonb(v_prepared_version));
  END LOOP;
  v_packet := jsonb_build_object(
    'version', 'social-content-decision-review/v1',
    'approval_id', v_approval_id,
    'run_id', v_run_id,
    'work_item_id', v_work_item_id,
    'content_id', p_social_content_id,
    'content_updated_at', v_now,
    'current_gate', p_current_gate,
    'next_gate', v_next_gate,
    'receipts', v_receipts,
    'source_receipts', v_prior_receipt.receipt_bundle,
    'source_content_updated_at', v_source_version,
    'prepared_from_content_updated_at', v_input_version,
    'prior_decision_receipt_id', v_prior_receipt.id,
    'visual_asset', CASE WHEN p_current_gate = 'visual_review' THEN jsonb_build_object('path', v_asset_path, 'sha256', v_asset_hash, 'approved_visual_receipt_id', v_prior_receipt.receipt_bundle -> 'visual' ->> 'receipt_id') ELSE NULL END,
    'candidate_projection', v_candidate_projection
  );

  INSERT INTO public.agent_runs (
    id, agent_key, runtime, kind, title, status, subject_type, subject_id,
    subject_label, current_step, trigger_source, triggered_by_user_id,
    metadata, idempotency_key, updated_at
  ) VALUES (
    v_run_id, 'chief-of-staff', 'manual', 'social_content_review',
    'Social Content internal ' || replace(p_current_gate, '_', ' ') || ' review',
    'waiting_for_approval', 'social_content_internal_review', p_social_content_id::TEXT,
    'Social Content', 'Awaiting canonical ' || replace(p_current_gate, '_', ' ') || ' decision',
    'portfolio_operator', p_triggered_by_user_id,
    jsonb_build_object('review_packet', v_packet, 'external_execution', false),
    p_idempotency_key || ':run', v_now
  );

  INSERT INTO public.agent_approvals (
    id, run_id, approval_type, status, requested_by_agent_key, metadata
  ) VALUES (
    v_approval_id, v_run_id, 'social_content_internal_review', 'pending',
    'chief-of-staff', jsonb_build_object('review_packet', v_packet, 'external_execution', false)
  );

  INSERT INTO public.agent_work_items (
    id, title, objective, status, priority, owner_agent_key, owner_runtime,
    source_type, source_id, source_label, source_run_id, active_run_id,
    overlap_group, validation_summary, approval_id, metadata, idempotency_key,
    updated_at
  ) VALUES (
    v_work_item_id,
    'Review Social Content ' || replace(p_current_gate, '_', ' ') || ' packet',
    'Review the exact version-bound packet and record one canonical internal decision.',
    'ready_for_review', 'high', 'chief-of-staff', 'manual',
    'social_content_internal_review', p_social_content_id::TEXT, 'Social Content',
    v_run_id, v_run_id, 'social-content-review',
    'Six exact approved evidence receipts are rebound to the current review version; external execution remains disabled.',
    v_approval_id,
    jsonb_build_object(
      'review_packet', v_packet,
      'recommendation', 'Review the current internal stage packet.',
      'risk', 'high',
      'external_execution', false
    ),
    p_idempotency_key, v_now
  );

  UPDATE public.social_content_queue
  SET rag_context = COALESCE(rag_context, '{}'::JSONB)
        || jsonb_build_object('mobile_decision_review', v_packet),
      updated_at = v_now
  WHERE id = p_social_content_id
  RETURNING updated_at INTO v_prepared_version;
  IF v_prepared_version IS DISTINCT FROM v_now THEN
    RAISE EXCEPTION 'Social Content version changed after packet binding';
  END IF;

  RETURN jsonb_build_object(
    'work_item_id', v_work_item_id,
    'approval_id', v_approval_id,
    'run_id', v_run_id,
    'content_updated_at', v_now,
    'current_gate', p_current_gate,
    'next_gate', v_next_gate,
    'idempotent_replay', false,
    'external_execution', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_social_content_stage_review(UUID, TIMESTAMPTZ, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_social_content_stage_review(UUID, TIMESTAMPTZ, TEXT, UUID, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.prepare_social_content_stage_review(UUID, TIMESTAMPTZ, TEXT, UUID, TEXT) IS
  'Idempotently prepares the next version-bound internal Social Content stage packet without external execution.';
