-- Reconcile immutable YouTube prerequisite receipt timestamps with the separately
-- prepared final-review queue version. All other stage contracts remain unchanged.
CREATE OR REPLACE FUNCTION public.record_social_content_stage_decision(
  p_social_content_id UUID,
  p_approval_id UUID,
  p_content_updated_at TIMESTAMPTZ,
  p_decision TEXT,
  p_decided_by_user_id UUID,
  p_idempotency_key TEXT,
  p_command_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.social_content_queue%ROWTYPE;
  v_approval public.agent_approvals%ROWTYPE;
  v_run public.agent_runs%ROWTYPE;
  v_work_item public.agent_work_items%ROWTYPE;
  v_receipt public.social_content_decision_receipts%ROWTYPE;
  v_packet JSONB;
  v_receipts JSONB;
  v_gate TEXT;
  v_next_gate TEXT;
  v_expected_command TEXT;
  v_key TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_command_payload JSONB;
  v_next_rag JSONB;
  v_youtube_source_decision public.social_content_decision_receipts%ROWTYPE;
  v_youtube_prerequisite public.dark_castle_prerequisite_receipts%ROWTYPE;
  v_youtube_final BOOLEAN;
  v_source_content_updated_at TIMESTAMPTZ;
BEGIN
  IF p_decision NOT IN ('approve', 'request_revision', 'hold') THEN
    RAISE EXCEPTION 'Invalid Social Content decision';
  END IF;
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Decision idempotency key is required';
  END IF;

  SELECT * INTO v_receipt
  FROM public.social_content_decision_receipts
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_receipt.social_content_id IS DISTINCT FROM p_social_content_id
       OR v_receipt.agent_approval_id IS DISTINCT FROM p_approval_id
       OR v_receipt.content_updated_at IS DISTINCT FROM p_content_updated_at
       OR v_receipt.decision IS DISTINCT FROM p_decision
       OR v_receipt.decided_by_user_id IS DISTINCT FROM p_decided_by_user_id
       OR v_receipt.command_name IS DISTINCT FROM p_command_name THEN
      RAISE EXCEPTION 'Decision replay identity mismatched';
    END IF;
    RETURN jsonb_build_object(
      'id', v_receipt.id,
      'decision', v_receipt.decision,
      'content_updated_at', v_receipt.content_updated_at,
      'next_internal_gate', v_receipt.next_internal_gate,
      'command_name', v_receipt.command_name,
      'created_at', v_receipt.created_at,
      'idempotent_replay', true,
      'external_execution', false
    );
  END IF;

  SELECT * INTO v_item
  FROM public.social_content_queue
  WHERE id = p_social_content_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Social Content item not found'; END IF;

  SELECT * INTO v_receipt
  FROM public.social_content_decision_receipts
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_receipt.social_content_id IS DISTINCT FROM p_social_content_id
       OR v_receipt.agent_approval_id IS DISTINCT FROM p_approval_id
       OR v_receipt.content_updated_at IS DISTINCT FROM p_content_updated_at
       OR v_receipt.decision IS DISTINCT FROM p_decision
       OR v_receipt.decided_by_user_id IS DISTINCT FROM p_decided_by_user_id
       OR v_receipt.command_name IS DISTINCT FROM p_command_name THEN
      RAISE EXCEPTION 'Decision replay identity mismatched';
    END IF;
    RETURN jsonb_build_object(
      'id', v_receipt.id,
      'decision', v_receipt.decision,
      'content_updated_at', v_receipt.content_updated_at,
      'next_internal_gate', v_receipt.next_internal_gate,
      'command_name', v_receipt.command_name,
      'created_at', v_receipt.created_at,
      'idempotent_replay', true,
      'external_execution', false
    );
  END IF;

  IF v_item.updated_at IS DISTINCT FROM p_content_updated_at THEN
    RAISE EXCEPTION 'Social Content review packet is stale';
  END IF;

  SELECT * INTO v_approval
  FROM public.agent_approvals
  WHERE id = p_approval_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Central Decision Queue approval not found'; END IF;
  IF v_approval.approval_type <> 'social_content_internal_review' THEN
    RAISE EXCEPTION 'Approval is not bound to Social Content internal review';
  END IF;
  IF v_approval.status <> 'pending' THEN
    RAISE EXCEPTION 'Central Decision Queue approval is not pending';
  END IF;

  v_packet := v_approval.metadata -> 'review_packet';
  v_receipts := v_packet -> 'receipts';
  IF jsonb_typeof(v_packet) <> 'object' OR jsonb_typeof(v_receipts) <> 'object' THEN
    RAISE EXCEPTION 'Central Decision Queue review packet is missing';
  END IF;
  IF (v_packet ->> 'version') IS DISTINCT FROM 'social-content-decision-review/v1'
     OR (v_packet ->> 'content_id') IS DISTINCT FROM p_social_content_id::TEXT
     OR (v_packet ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM p_content_updated_at
     OR (v_packet ->> 'run_id') IS DISTINCT FROM v_approval.run_id::TEXT THEN
    RAISE EXCEPTION 'Central Decision Queue review packet is stale or incorrectly bound';
  END IF;
  IF (v_item.rag_context -> 'mobile_decision_review' ->> 'approval_id') IS DISTINCT FROM v_approval.id::TEXT
     OR (v_item.rag_context -> 'mobile_decision_review' ->> 'run_id') IS DISTINCT FROM v_approval.run_id::TEXT
     OR (v_item.rag_context -> 'mobile_decision_review' ->> 'work_item_id') IS DISTINCT FROM (v_packet ->> 'work_item_id') THEN
    RAISE EXCEPTION 'Social Content item is not bound to the central Decision Queue packet';
  END IF;

  -- Final YouTube packet preparation advances the queue row timestamp but
  -- carries the six immutable prerequisites from the approved privacy decision.
  -- Keep those evidence timestamps bound to that decision's approved version.
  IF v_packet ->> 'platform' = 'youtube' AND v_item.platform IS DISTINCT FROM 'youtube' THEN
    RAISE EXCEPTION 'YouTube final packet channel mismatched';
  END IF;
  v_youtube_final := v_item.platform = 'youtube'
    AND v_packet ->> 'platform' = 'youtube'
    AND v_packet ->> 'current_gate' = 'platform_submission';
  IF v_youtube_final THEN
    SELECT * INTO v_youtube_source_decision
    FROM public.social_content_decision_receipts
    WHERE id = (v_packet ->> 'privacy_decision_receipt_id')::UUID
      AND social_content_id = p_social_content_id
      AND current_gate = 'privacy' AND decision = 'approve'
      AND command_name = 'approve_privacy'
      AND next_internal_gate = 'platform_submission';
    IF NOT FOUND
       OR v_item.rag_context -> 'mobile_decision_review' IS DISTINCT FROM v_packet
       OR v_item.rag_context ->> 'content_version' IS DISTINCT FROM v_packet ->> 'content_version'
       OR v_item.rag_context ->> 'latest_internal_decision_receipt_id' IS DISTINCT FROM v_youtube_source_decision.id::TEXT
       OR (SELECT count(*) FROM public.social_content_decision_receipts
           WHERE social_content_id = p_social_content_id AND current_gate = 'privacy'
             AND decision = 'approve' AND command_name = 'approve_privacy'
             AND next_internal_gate = 'platform_submission') <> 1
       OR v_packet -> 'source_receipts' IS DISTINCT FROM v_youtube_source_decision.receipt_bundle
       OR v_receipts IS DISTINCT FROM v_youtube_source_decision.receipt_bundle
       OR v_packet -> 'candidate_projection' IS DISTINCT FROM v_youtube_source_decision.candidate_projection
       OR v_packet ->> 'master_sha256' IS DISTINCT FROM v_item.rag_context -> 'dark_castle_master_binding' ->> 'sha256'
       OR v_packet ->> 'thumbnail_sha256' IS DISTINCT FROM v_item.rag_context -> 'dark_castle_thumbnail_binding' ->> 'sha256'
       OR v_packet ->> 'thumbnail_direction' IS DISTINCT FROM v_item.rag_context -> 'dark_castle_thumbnail_binding' ->> 'direction'
       OR v_packet ->> 'prepared_from_content_updated_at' IS NULL
       OR (v_packet ->> 'prepared_from_content_updated_at')::TIMESTAMPTZ < v_youtube_source_decision.content_updated_at THEN
      RAISE EXCEPTION 'YouTube final packet source decision is stale or identity mismatched';
    END IF;
    v_source_content_updated_at := v_youtube_source_decision.content_updated_at;
  ELSE
    v_source_content_updated_at := p_content_updated_at;
  END IF;

  FOREACH v_key IN ARRAY ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']
  LOOP
    IF jsonb_typeof(v_receipts -> v_key) <> 'object'
       OR NULLIF(BTRIM(v_receipts -> v_key ->> 'receipt_id'), '') IS NULL
       OR LOWER(COALESCE(v_receipts -> v_key ->> 'status', '')) NOT IN ('approved', 'passed', 'complete')
       OR (v_receipts -> v_key ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM v_source_content_updated_at THEN
      RAISE EXCEPTION '% receipt is missing, failed, or stale', INITCAP(v_key);
    END IF;
    IF v_youtube_final THEN
      SELECT * INTO v_youtube_prerequisite
      FROM public.dark_castle_prerequisite_receipts
      WHERE receipt_id = v_receipts -> v_key ->> 'receipt_id'
        AND kind = v_key AND social_content_id = p_social_content_id
        AND content_version = v_packet ->> 'content_version';
      IF NOT FOUND
         OR v_youtube_prerequisite.receipt ->> 'receipt_id' IS DISTINCT FROM v_youtube_prerequisite.receipt_id
         OR v_youtube_prerequisite.receipt ->> 'status' IS DISTINCT FROM 'approved'
         OR v_youtube_prerequisite.receipt ->> 'packet_id' IS DISTINCT FROM v_youtube_prerequisite.packet_id
         OR v_youtube_prerequisite.receipt ->> 'evidence_fingerprint' IS DISTINCT FROM v_youtube_prerequisite.evidence_fingerprint
         OR v_receipts -> v_key ->> 'packet_id' IS DISTINCT FROM v_youtube_prerequisite.packet_id
         OR v_receipts -> v_key ->> 'evidence_fingerprint' IS DISTINCT FROM v_youtube_prerequisite.evidence_fingerprint
         OR v_youtube_prerequisite.artifact_hashes ->> 'master_sha256' IS DISTINCT FROM v_packet ->> 'master_sha256'
         OR v_youtube_prerequisite.artifact_hashes ->> 'thumbnail_sha256' IS DISTINCT FROM v_packet ->> 'thumbnail_sha256'
         OR (v_key = 'visual' AND (
           v_youtube_prerequisite.receipt ->> 'asset_sha256' IS DISTINCT FROM 'sha256:' || (v_packet ->> 'thumbnail_sha256')
           OR v_youtube_prerequisite.receipt ->> 'asset_path' IS DISTINCT FROM v_item.image_url)) THEN
        RAISE EXCEPTION 'Immutable % prerequisite receipt mismatch', v_key;
      END IF;
    END IF;
  END LOOP;
  IF v_youtube_final AND (SELECT count(*) FROM public.dark_castle_prerequisite_receipts
      WHERE social_content_id = p_social_content_id AND content_version = v_packet ->> 'content_version') <> 6 THEN
    RAISE EXCEPTION 'Exactly six unique immutable prerequisites required';
  END IF;

  SELECT * INTO v_run
  FROM public.agent_runs
  WHERE id = v_approval.run_id
    AND subject_type = 'social_content_internal_review'
    AND subject_id = p_social_content_id::TEXT
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agent Ops run is not bound to this Social Content item'; END IF;

  SELECT * INTO v_work_item
  FROM public.agent_work_items
  WHERE id = (v_packet ->> 'work_item_id')::UUID
    AND active_run_id = v_run.id
    AND approval_id = v_approval.id
    AND source_type = 'social_content_internal_review'
    AND source_id = p_social_content_id::TEXT
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Decision Queue work item is not bound to this review packet'; END IF;

  v_gate := v_packet ->> 'current_gate';
  IF v_gate NOT IN ('copy', 'copy_review', 'visual_review', 'visual_assets', 'asset_packet', 'privacy', 'platform_submission', 'submit') THEN
    RAISE EXCEPTION 'Review packet does not name a supported canonical Social Content stage';
  END IF;

  v_expected_command := CASE
    WHEN p_decision = 'hold' THEN 'hold_' || v_gate
    WHEN v_gate IN ('copy', 'copy_review') AND p_decision = 'approve' THEN 'approve_copy'
    WHEN v_gate IN ('copy', 'copy_review') THEN 'request_copy_revision'
    WHEN v_gate IN ('platform_submission', 'submit') AND p_decision = 'approve' THEN 'approve_platform_submission'
    WHEN v_gate IN ('platform_submission', 'submit') THEN 'request_platform_submission_revision'
    WHEN p_decision = 'approve' THEN 'approve_' || v_gate
    ELSE 'reject_' || v_gate
  END;
  IF p_command_name IS DISTINCT FROM v_expected_command THEN
    RAISE EXCEPTION 'Canonical Social Content command does not match the packet stage';
  END IF;

  v_next_gate := CASE
    WHEN p_decision = 'approve' THEN v_packet ->> 'next_gate'
    ELSE v_gate
  END;
  IF NULLIF(BTRIM(v_next_gate), '') IS NULL THEN
    RAISE EXCEPTION 'Review packet next-gate binding is incomplete';
  END IF;

  v_command_payload := jsonb_build_object(
    'command', p_command_name,
    'stage', v_gate,
    'decision', p_decision,
    'reviewed_content_updated_at', p_content_updated_at,
    'next_internal_gate', v_next_gate,
    'external_execution', false
  );

  INSERT INTO public.social_content_decision_receipts (
    social_content_id, agent_run_id, agent_approval_id, agent_work_item_id,
    content_updated_at, decision, decided_by_user_id, current_gate,
    next_internal_gate, receipt_bundle, candidate_projection, idempotency_key,
    command_name, command_payload
  ) VALUES (
    p_social_content_id, v_run.id, v_approval.id, v_work_item.id,
    p_content_updated_at, p_decision, p_decided_by_user_id, v_gate,
    v_next_gate, v_receipts, v_packet -> 'candidate_projection', p_idempotency_key,
    p_command_name, v_command_payload
  )
  RETURNING * INTO v_receipt;

  -- Hold is a Decision Queue command only. It never mutates canonical content.
  IF p_decision <> 'hold' THEN
    v_next_rag := COALESCE(v_item.rag_context, '{}'::JSONB)
      || jsonb_build_object(
        'current_gate', v_next_gate,
        'latest_internal_decision_receipt_id', v_receipt.id,
        'latest_internal_decision', p_decision,
        'latest_internal_decision_command', p_command_name
      );

    IF v_gate IN ('visual_review', 'visual_assets', 'asset_packet', 'privacy') THEN
      v_next_rag := v_next_rag || jsonb_build_object(
        'section_gate_reviews',
        COALESCE(v_item.rag_context -> 'section_gate_reviews', '{}'::JSONB)
          || jsonb_build_object(v_gate, jsonb_build_object(
            'status', CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
            'decided_at', v_now,
            'decided_by', p_decided_by_user_id,
            'note', CASE WHEN p_decision = 'request_revision' THEN 'Revision requested from the canonical Decision Queue.' ELSE NULL END,
            'decision_receipt_id', v_receipt.id
          ))
      );
    ELSIF v_gate IN ('platform_submission', 'submit') THEN
      v_next_rag := v_next_rag || jsonb_build_object(
        'platform_submission_gate',
        COALESCE(v_item.rag_context -> 'platform_submission_gate', '{}'::JSONB)
          || jsonb_build_object(
            'status', CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
            'approved_version', CASE WHEN p_decision = 'approve' THEN p_content_updated_at ELSE NULL END,
            'approved_at', CASE WHEN p_decision = 'approve' THEN v_now ELSE NULL END,
            'approved_by', CASE WHEN p_decision = 'approve' THEN p_decided_by_user_id ELSE NULL END,
            'submit_after_approval', false,
            'decision_receipt_id', v_receipt.id,
            'boundary', 'Internal platform-submission readiness only. Provider submission, upload, scheduling, and publishing remain separately gated.'
          )
      );
    END IF;

    UPDATE public.social_content_queue
    SET status = CASE
          WHEN v_gate IN ('copy', 'copy_review') AND p_decision = 'approve' THEN 'approved'
          WHEN v_gate IN ('copy', 'copy_review') AND p_decision = 'request_revision' THEN 'rejected'
          ELSE status
        END,
        reviewed_by = CASE WHEN v_gate IN ('copy', 'copy_review') THEN p_decided_by_user_id ELSE reviewed_by END,
        rag_context = v_next_rag,
        updated_at = v_now
    WHERE id = p_social_content_id;
  END IF;

  UPDATE public.agent_approvals
  SET status = CASE
        WHEN p_decision = 'approve' THEN 'approved'
        WHEN p_decision = 'request_revision' THEN 'rejected'
        ELSE status
      END,
      decided_by_user_id = CASE WHEN p_decision = 'hold' THEN NULL ELSE p_decided_by_user_id END,
      decided_at = CASE WHEN p_decision = 'hold' THEN NULL ELSE v_now END,
      decision_notes = CASE
        WHEN p_decision = 'approve' THEN 'Canonical Social Content stage command approved.'
        WHEN p_decision = 'request_revision' THEN 'Canonical Social Content stage returned for revision.'
        ELSE 'Held in the central Decision Queue without changing canonical content.'
      END,
      metadata = metadata || jsonb_build_object(
        'latest_decision_receipt_id', v_receipt.id,
        'latest_decision', p_decision,
        'canonical_command', p_command_name,
        'external_execution', false
      )
  WHERE id = v_approval.id;

  UPDATE public.agent_work_items
  SET status = CASE WHEN p_decision = 'hold' THEN 'blocked' ELSE 'assigned' END,
      blocker_summary = CASE WHEN p_decision = 'hold' THEN 'Held by the reviewer in the central Decision Queue.' ELSE NULL END,
      validation_summary = CASE
        WHEN p_decision = 'approve' THEN 'Canonical stage command and immutable receipt recorded; no external execution authorized.'
        WHEN p_decision = 'request_revision' THEN 'Canonical stage returned for revision with an immutable receipt; no external execution authorized.'
        ELSE 'Held without changing canonical content or authorizing external execution.'
      END,
      metadata = metadata || jsonb_build_object(
        'latest_decision_receipt_id', v_receipt.id,
        'latest_decision', p_decision,
        'canonical_command', p_command_name,
        'next_internal_gate', v_next_gate,
        'external_execution', false
      ),
      updated_at = v_now
  WHERE id = v_work_item.id;

  UPDATE public.agent_runs
  SET status = CASE WHEN p_decision = 'hold' THEN 'waiting_for_approval' ELSE 'running' END,
      current_step = CASE
        WHEN p_decision = 'approve' THEN 'Canonical stage advanced: ' || v_next_gate
        WHEN p_decision = 'request_revision' THEN 'Canonical stage revision requested: ' || v_gate
        ELSE 'Decision held by reviewer'
      END,
      error_message = NULL,
      updated_at = v_now
  WHERE id = v_run.id;

  INSERT INTO public.agent_run_events (
    run_id, event_type, severity, message, metadata, idempotency_key
  ) VALUES (
    v_run.id,
    'social_content_stage_decision_recorded',
    CASE WHEN p_decision = 'request_revision' THEN 'warning' ELSE 'info' END,
    'Social Content canonical command: ' || p_command_name,
    jsonb_build_object(
      'receipt_id', v_receipt.id,
      'social_content_id', p_social_content_id,
      'decision', p_decision,
      'canonical_command', p_command_name,
      'content_updated_at', p_content_updated_at,
      'next_internal_gate', v_next_gate,
      'external_execution', false
    ),
    p_idempotency_key
  );

  RETURN jsonb_build_object(
    'id', v_receipt.id,
    'decision', v_receipt.decision,
    'content_updated_at', v_receipt.content_updated_at,
    'next_internal_gate', v_receipt.next_internal_gate,
    'command_name', v_receipt.command_name,
    'created_at', v_receipt.created_at,
    'idempotent_replay', false,
    'external_execution', false
  );
END;
$$;


REVOKE ALL ON FUNCTION public.record_social_content_stage_decision(UUID, UUID, TIMESTAMPTZ, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_social_content_stage_decision(UUID, UUID, TIMESTAMPTZ, TEXT, UUID, TEXT, TEXT)
  TO service_role;
