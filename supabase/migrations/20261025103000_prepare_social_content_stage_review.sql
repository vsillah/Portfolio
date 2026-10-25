-- Prepare the next receipt-backed Social Content review stage.
-- This only creates internal Agent Ops review records and binds them to the
-- current content version. It cannot render, upload, schedule, publish, send,
-- call a provider, or authorize external execution.

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
BEGIN
  IF p_current_gate NOT IN ('asset_packet', 'privacy') THEN
    RAISE EXCEPTION 'Unsupported Social Content review stage';
  END IF;
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Review preparation idempotency key is required';
  END IF;

  -- Serialize retries before checking the unique idempotency key so concurrent
  -- operator clicks resolve to one packet instead of one success and one error.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  SELECT * INTO v_existing_work
  FROM public.agent_work_items
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'work_item_id', v_existing_work.id,
      'approval_id', v_existing_work.approval_id,
      'run_id', v_existing_work.active_run_id,
      'current_gate', p_current_gate,
      'idempotent_replay', true,
      'external_execution', false
    );
  END IF;

  SELECT * INTO v_item
  FROM public.social_content_queue
  WHERE id = p_social_content_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Social Content item not found'; END IF;
  IF v_item.updated_at IS DISTINCT FROM p_expected_content_updated_at THEN
    RAISE EXCEPTION 'Social Content stage preparation is stale';
  END IF;
  IF (v_item.rag_context ->> 'current_gate') IS DISTINCT FROM p_current_gate THEN
    RAISE EXCEPTION 'Social Content current gate does not match requested stage';
  END IF;

  SELECT * INTO v_prior_receipt
  FROM public.social_content_decision_receipts
  WHERE social_content_id = p_social_content_id
    AND decision = 'approve'
    AND next_internal_gate = p_current_gate
    AND id::TEXT = v_item.rag_context ->> 'latest_internal_decision_receipt_id'
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved prior-stage receipt is required';
  END IF;

  v_receipts := v_prior_receipt.receipt_bundle;
  IF jsonb_typeof(v_receipts) <> 'object' THEN
    RAISE EXCEPTION 'Prior-stage receipt bundle is missing';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']
  LOOP
    IF NULLIF(BTRIM(v_receipts -> v_key ->> 'receipt_id'), '') IS NULL
       OR LOWER(COALESCE(v_receipts -> v_key ->> 'status', '')) NOT IN ('approved', 'passed', 'complete') THEN
      RAISE EXCEPTION 'Prior-stage % receipt is missing or not approved', v_key;
    END IF;
    v_receipts := jsonb_set(v_receipts, ARRAY[v_key, 'content_updated_at'], to_jsonb(v_now), true);
  END LOOP;

  v_next_gate := CASE p_current_gate
    WHEN 'asset_packet' THEN 'privacy'
    WHEN 'privacy' THEN 'platform_submission'
  END;
  v_candidate_projection := COALESCE(v_prior_receipt.candidate_projection, '{}'::JSONB);
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
    'Six inherited approved evidence receipts are rebound to the current post-decision version; external execution remains disabled.',
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
  WHERE id = p_social_content_id;

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
