-- Bind review freshness to the two rows persisted by handoff creation. The
-- packet clock is intentionally independent and is still checked exactly via
-- p_expected_handoff_created_at and the immutable packet comparison.
CREATE OR REPLACE FUNCTION public.record_social_linkedin_handoff_decision(
  p_social_content_id UUID,
  p_work_item_id UUID,
  p_privacy_receipt_id UUID,
  p_expected_handoff_created_at TIMESTAMPTZ,
  p_decision TEXT,
  p_decided_by_user_id UUID,
  p_note TEXT,
  p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_item public.social_content_queue%ROWTYPE;
  v_work public.agent_work_items%ROWTYPE;
  v_privacy public.social_content_decision_receipts%ROWTYPE;
  v_prior public.social_linkedin_handoff_decisions%ROWTYPE;
  v_handoff JSONB;
  v_packet JSONB;
  v_candidate JSONB;
  v_lead JSONB;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_decision NOT IN ('approve', 'request_revision') THEN
    RAISE EXCEPTION 'Unsupported LinkedIn handoff decision';
  END IF;
  IF p_idempotency_key IS DISTINCT FROM
     ('linkedin-handoff-review:' || p_work_item_id::TEXT || ':' || p_privacy_receipt_id::TEXT || ':' || p_decision) THEN
    RAISE EXCEPTION 'LinkedIn handoff idempotency binding mismatch';
  END IF;
  IF p_decision = 'request_revision' AND NULLIF(BTRIM(COALESCE(p_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Revision reason is required';
  END IF;

  SELECT * INTO v_item FROM public.social_content_queue WHERE id = p_social_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Social Content item not found'; END IF;
  SELECT * INTO v_work FROM public.agent_work_items WHERE id = p_work_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LinkedIn handoff work item not found'; END IF;
  SELECT * INTO v_prior FROM public.social_linkedin_handoff_decisions WHERE work_item_id = p_work_item_id;
  IF FOUND THEN
    IF v_prior.idempotency_key IS DISTINCT FROM p_idempotency_key
       OR v_prior.decision IS DISTINCT FROM p_decision
       OR v_prior.social_content_id IS DISTINCT FROM p_social_content_id
       OR v_prior.privacy_receipt_id IS DISTINCT FROM p_privacy_receipt_id
       OR (v_prior.handoff_packet ->> 'created_at')::TIMESTAMPTZ IS DISTINCT FROM p_expected_handoff_created_at
       OR v_prior.handoff_packet IS DISTINCT FROM ((v_item.rag_context -> 'linkedin_draft_handoff') - 'work_item')
       OR v_work.metadata ->> 'handoff_review_receipt_id' IS DISTINCT FROM v_prior.id::TEXT
       OR v_prior.note IS DISTINCT FROM NULLIF(BTRIM(p_note), '') THEN
      RAISE EXCEPTION 'LinkedIn handoff already has a different decision';
    END IF;
    RETURN jsonb_build_object('id', v_prior.id, 'decision', v_prior.decision,
      'created_at', v_prior.created_at, 'idempotent_replay', true, 'external_execution', false);
  END IF;

  v_handoff := v_item.rag_context -> 'linkedin_draft_handoff';
  v_packet := v_work.metadata -> 'draft_packet';
  v_candidate := v_handoff -> 'candidate_projection';
  IF v_item.status IS DISTINCT FROM 'approved'
     OR v_item.platform IS DISTINCT FROM 'linkedin'
     OR v_work.status IS DISTINCT FROM 'ready_for_review'
     OR v_work.source_type IS DISTINCT FROM 'social_content_linkedin_draft_handoff'
     OR v_work.source_id IS DISTINCT FROM p_social_content_id::TEXT
     OR v_work.idempotency_key IS DISTINCT FROM ('social-content-linkedin-receipt-handoff:' || p_social_content_id::TEXT)
     OR v_work.metadata ->> 'external_execution' IS DISTINCT FROM 'false'
     OR v_work.metadata -> 'draft_packet' IS DISTINCT FROM (v_handoff - 'work_item')
     OR v_handoff -> 'work_item' ->> 'id' IS DISTINCT FROM p_work_item_id::TEXT
     OR v_handoff ->> 'version' IS DISTINCT FROM 'linkedin_draft_handoff_v2'
     OR v_handoff ->> 'status' IS DISTINCT FROM 'ready_for_internal_review'
     OR v_handoff ->> 'external_execution' IS DISTINCT FROM 'false'
     OR v_handoff ->> 'external_account_draft_created' IS DISTINCT FROM 'false'
     OR (v_handoff ->> 'created_at')::TIMESTAMPTZ IS DISTINCT FROM p_expected_handoff_created_at
     OR v_item.updated_at IS DISTINCT FROM v_work.updated_at
     OR v_handoff ->> 'privacy_decision_receipt_id' IS DISTINCT FROM p_privacy_receipt_id::TEXT
     OR v_item.rag_context ->> 'latest_internal_decision_receipt_id' IS DISTINCT FROM p_privacy_receipt_id::TEXT
     OR v_item.rag_context ->> 'current_gate' IS DISTINCT FROM 'platform_submission'
     OR v_item.rag_context ->> 'latest_internal_decision_command' IS DISTINCT FROM 'approve_privacy'
     OR v_handoff -> 'candidate_projection' IS DISTINCT FROM v_item.rag_context -> 'copy_review_candidate_projection'
     OR v_handoff ->> 'post_text' IS DISTINCT FROM v_item.post_text
     OR v_handoff ->> 'cta_text' IS DISTINCT FROM v_item.cta_text
     OR v_handoff ->> 'cta_url' IS DISTINCT FROM v_item.cta_url
     OR v_handoff -> 'hashtags' IS DISTINCT FROM to_jsonb(v_item.hashtags)
     OR v_handoff -> 'visual_asset' ->> 'image_url' IS DISTINCT FROM v_item.image_url
     OR v_handoff ->> 'approved_visual_sha256' IS DISTINCT FROM v_item.rag_context ->> 'approved_visual_sha256'
     OR v_candidate ->> 'visual_sha256' IS DISTINCT FROM v_handoff ->> 'approved_visual_sha256'
     OR v_candidate ->> 'post_text' IS DISTINCT FROM v_item.post_text
     OR v_candidate ->> 'cta_text' IS DISTINCT FROM v_item.cta_text
     OR v_candidate ->> 'cta_url' IS DISTINCT FROM v_item.cta_url
     OR v_candidate ->> 'image_url' IS DISTINCT FROM v_item.image_url
     OR v_item.scheduled_for IS NOT NULL OR v_item.published_at IS NOT NULL
     OR v_item.platform_post_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.social_content_publishes WHERE content_id = p_social_content_id)
     OR v_item.rag_context -> 'platform_submission_gate' ->> 'status' IN ('approved','submitting','partially_submitted','submitted','published','uncertain','ambiguous')
     OR (SELECT count(*) FROM public.agent_work_items WHERE source_type = 'social_content_linkedin_draft_handoff'
           AND source_id = p_social_content_id::TEXT) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'LinkedIn handoff is stale, incomplete, duplicate, or mismatched';
  END IF;

  SELECT * INTO v_privacy FROM public.social_content_decision_receipts
  WHERE id = p_privacy_receipt_id AND social_content_id = p_social_content_id
    AND current_gate = 'privacy' AND decision = 'approve'
    AND command_name = 'approve_privacy' AND next_internal_gate = 'platform_submission';
  IF NOT FOUND OR v_privacy.candidate_projection IS DISTINCT FROM v_candidate
     OR v_privacy.receipt_bundle IS DISTINCT FROM v_handoff -> 'evidence_receipts'
     OR v_handoff -> 'canonical_decision_lineage' ->> 'privacy_receipt_id' IS DISTINCT FROM p_privacy_receipt_id::TEXT THEN
    RAISE EXCEPTION 'Immutable privacy receipt or lineage mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(v_handoff -> 'canonical_decision_lineage') AS l
    WHERE l.key IN ('copy_receipt_id','visual_review_receipt_id','asset_packet_receipt_id')
      AND NOT EXISTS (SELECT 1 FROM public.social_content_decision_receipts r
        WHERE r.id::TEXT = l.value #>> '{}' AND r.social_content_id = p_social_content_id
          AND r.decision = 'approve' AND r.candidate_projection = v_candidate
          AND r.created_at < v_privacy.created_at))
     OR (SELECT count(*) FROM jsonb_each(v_handoff -> 'canonical_decision_lineage')) IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'Canonical decision lineage is missing or mismatched';
  END IF;
  v_lead := v_item.rag_context -> 'lead_magnet_receipt';
  IF (v_candidate ? 'lead_magnet_receipt_id') AND
     (jsonb_typeof(v_lead) IS DISTINCT FROM 'object'
      OR v_lead ->> 'receipt_id' IS DISTINCT FROM v_candidate ->> 'lead_magnet_receipt_id'
      OR v_lead ->> 'status' IS DISTINCT FROM 'approved'
      OR v_lead ->> 'url' IS DISTINCT FROM v_item.cta_url) THEN
    RAISE EXCEPTION 'Lead magnet receipt or CTA binding mismatch';
  END IF;

  INSERT INTO public.social_linkedin_handoff_decisions (
    social_content_id, work_item_id, privacy_receipt_id, decision, decided_by_user_id,
    handoff_packet, note, idempotency_key
  ) VALUES (p_social_content_id, p_work_item_id, p_privacy_receipt_id, p_decision,
    p_decided_by_user_id, v_packet, NULLIF(BTRIM(p_note), ''), p_idempotency_key)
  RETURNING * INTO v_prior;

  UPDATE public.agent_work_items SET status = 'blocked',
    validation_summary = CASE WHEN p_decision = 'approve'
      THEN 'Exact LinkedIn handoff approved for final platform-submission readiness only; no external execution.'
      ELSE 'LinkedIn handoff returned for revision; no external execution.' END,
    blocker_summary = CASE WHEN p_decision = 'request_revision' THEN NULLIF(BTRIM(p_note), '')
      ELSE 'Final platform-submission review remains required; no provider action is authorized.' END,
    metadata = metadata || jsonb_build_object('handoff_review_receipt_id', v_prior.id,
      'handoff_review_decision', p_decision, 'external_execution', false),
    updated_at = v_now WHERE id = p_work_item_id;
  UPDATE public.social_content_queue SET rag_context = rag_context || jsonb_build_object(
    'linkedin_handoff_review', jsonb_build_object('decision_receipt_id', v_prior.id,
      'decision', p_decision, 'next_internal_gate', CASE WHEN p_decision = 'approve'
        THEN 'final_platform_submission_readiness' ELSE 'linkedin_handoff_revision' END,
      'external_execution', false)), updated_at = v_now WHERE id = p_social_content_id;

  RETURN jsonb_build_object('id', v_prior.id, 'decision', p_decision,
    'created_at', v_prior.created_at, 'idempotent_replay', false,
    'next_internal_gate', CASE WHEN p_decision = 'approve' THEN 'final_platform_submission_readiness'
      ELSE 'linkedin_handoff_revision' END, 'external_execution', false);
END;
$$;

REVOKE ALL ON FUNCTION public.record_social_linkedin_handoff_decision(UUID, UUID, UUID, TIMESTAMPTZ, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_social_linkedin_handoff_decision(UUID, UUID, UUID, TIMESTAMPTZ, TEXT, UUID, TEXT, TEXT)
  TO service_role;
