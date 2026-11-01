-- Atomically create one internal LinkedIn review handoff from the current
-- canonical privacy decision. No provider or publication operation exists here.
CREATE OR REPLACE FUNCTION public.create_receipt_backed_linkedin_handoff(
  p_social_content_id UUID,
  p_expected_content_updated_at TIMESTAMPTZ,
  p_privacy_receipt_id UUID,
  p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.social_content_queue%ROWTYPE;
  v_privacy public.social_content_decision_receipts%ROWTYPE;
  v_prior public.social_content_decision_receipts%ROWTYPE;
  v_prior_id UUID;
  v_copy_id UUID;
  v_visual_id UUID;
  v_asset_id UUID;
  v_copy_at TIMESTAMPTZ;
  v_visual_at TIMESTAMPTZ;
  v_asset_at TIMESTAMPTZ;
  v_work public.agent_work_items%ROWTYPE;
  v_existing JSONB;
  v_packet JSONB;
  v_candidate JSONB;
  v_bundle JSONB;
  v_receipt JSONB;
  v_visual_hash TEXT;
  v_key TEXT;
  v_receipt_key TEXT;
  v_seen TEXT[] := ARRAY[]::TEXT[];
  v_count INTEGER;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_idempotency_key TEXT := 'social-content-linkedin-receipt-handoff:' || p_social_content_id::TEXT;
BEGIN
  SELECT * INTO v_item FROM public.social_content_queue
  WHERE id = p_social_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Social Content item not found'; END IF;
  IF v_item.scheduled_for IS NOT NULL OR v_item.published_at IS NOT NULL
     OR v_item.platform_post_id IS NOT NULL OR v_item.platform_post_url IS NOT NULL
     OR v_item.rag_context -> 'platform_submission_gate' ->> 'status' IN ('approved', 'submitting', 'partially_submitted', 'submitted', 'published', 'uncertain', 'ambiguous')
     OR EXISTS (SELECT 1 FROM public.social_content_publishes WHERE content_id = p_social_content_id) THEN
    RAISE EXCEPTION 'Existing provider or publication evidence blocks draft handoff';
  END IF;

  v_existing := v_item.rag_context -> 'linkedin_draft_handoff';
  IF v_existing IS NOT NULL THEN
    IF v_existing ->> 'version' IS DISTINCT FROM 'linkedin_draft_handoff_v2'
       OR v_existing ->> 'social_content_id' IS DISTINCT FROM p_social_content_id::TEXT
       OR (v_existing ->> 'source_content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM p_expected_content_updated_at
       OR v_existing ->> 'privacy_decision_receipt_id' IS DISTINCT FROM p_privacy_receipt_id::TEXT
       OR v_existing ->> 'external_account_draft_created' IS DISTINCT FROM 'false'
       OR v_item.rag_context ->> 'current_gate' IS DISTINCT FROM 'platform_submission'
       OR v_item.rag_context ->> 'latest_internal_decision_receipt_id' IS DISTINCT FROM p_privacy_receipt_id::TEXT
       OR v_existing -> 'candidate_projection' IS DISTINCT FROM v_item.rag_context -> 'copy_review_candidate_projection'
       OR v_existing ->> 'post_text' IS DISTINCT FROM v_item.post_text
       OR v_existing ->> 'approved_visual_sha256' IS DISTINCT FROM v_item.rag_context ->> 'approved_visual_sha256'
       OR v_existing -> 'visual_asset' ->> 'image_url' IS DISTINCT FROM v_item.image_url
       OR v_existing -> 'work_item' ->> 'id' IS NULL THEN
      RAISE EXCEPTION 'Existing LinkedIn handoff is ambiguous or bound to another version';
    END IF;
    SELECT * INTO v_work FROM public.agent_work_items
    WHERE id::TEXT = v_existing -> 'work_item' ->> 'id'
      AND source_type = 'social_content_linkedin_draft_handoff'
      AND source_id = p_social_content_id::TEXT
      AND idempotency_key = v_idempotency_key;
    IF NOT FOUND OR v_work.metadata -> 'draft_packet' IS DISTINCT FROM v_existing - 'work_item' THEN
      RAISE EXCEPTION 'Existing LinkedIn work item does not match the handoff';
    END IF;
    SELECT count(*) INTO v_count FROM public.agent_work_items
    WHERE source_type = 'social_content_linkedin_draft_handoff'
      AND source_id = p_social_content_id::TEXT;
    IF v_count IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'Duplicate or ambiguous LinkedIn handoff work item';
    END IF;
    RETURN jsonb_build_object('handoff', v_existing, 'idempotent_replay', true, 'external_execution', false);
  END IF;

  IF v_item.updated_at IS DISTINCT FROM p_expected_content_updated_at THEN
    RAISE EXCEPTION 'Social Content version is stale';
  END IF;
  IF v_item.status IS DISTINCT FROM 'approved'
     OR v_item.platform IS DISTINCT FROM 'linkedin'
     OR v_item.rag_context ->> 'current_gate' IS DISTINCT FROM 'platform_submission'
     OR v_item.rag_context ->> 'latest_internal_decision' IS DISTINCT FROM 'approve'
     OR v_item.rag_context ->> 'latest_internal_decision_receipt_id' IS DISTINCT FROM p_privacy_receipt_id::TEXT
     OR v_item.rag_context ->> 'latest_internal_decision_command' IS DISTINCT FROM 'approve_privacy' THEN
    RAISE EXCEPTION 'Canonical privacy approval and lifecycle ordering are required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.agent_work_items
             WHERE source_type = 'social_content_linkedin_draft_handoff'
               AND source_id = p_social_content_id::TEXT)
     OR EXISTS (SELECT 1 FROM public.agent_work_items WHERE idempotency_key = v_idempotency_key) THEN
    RAISE EXCEPTION 'Duplicate or ambiguous LinkedIn handoff work item';
  END IF;

  SELECT * INTO v_privacy FROM public.social_content_decision_receipts
  WHERE id = p_privacy_receipt_id AND social_content_id = p_social_content_id
    AND decision = 'approve' AND current_gate = 'privacy'
    AND next_internal_gate = 'platform_submission' AND command_name = 'approve_privacy';
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact immutable privacy decision receipt is required'; END IF;
  v_candidate := v_privacy.candidate_projection;
  v_bundle := v_privacy.receipt_bundle;
  IF jsonb_typeof(v_candidate) IS DISTINCT FROM 'object'
     OR v_candidate IS DISTINCT FROM v_item.rag_context -> 'copy_review_candidate_projection'
     OR v_candidate ->> 'post_text' IS DISTINCT FROM v_item.post_text
     OR v_candidate ->> 'cta_text' IS DISTINCT FROM v_item.cta_text
     OR v_candidate ->> 'cta_url' IS DISTINCT FROM v_item.cta_url
     OR v_candidate ->> 'image_url' IS DISTINCT FROM v_item.image_url
     OR v_item.image_url IS NULL THEN
    RAISE EXCEPTION 'Current candidate projection, copy, or visual path mismatch';
  END IF;
  v_visual_hash := v_candidate ->> 'visual_sha256';
  IF v_visual_hash IS NULL OR v_visual_hash !~ '^sha256:[a-f0-9]{64}$'
     OR v_visual_hash IS DISTINCT FROM v_item.rag_context ->> 'approved_visual_sha256'
     OR v_item.image_url !~ '^(/[^/]|https://[^/]+/)'
     OR v_item.image_url ~ '[[:space:]?#]' OR v_item.image_url LIKE '%..%' THEN
    RAISE EXCEPTION 'Approved visual hash or safe asset path mismatch';
  END IF;
  IF jsonb_typeof(v_bundle) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Privacy decision receipt bundle is missing';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'] LOOP
    v_receipt := v_bundle -> v_key;
    IF jsonb_typeof(v_receipt) IS DISTINCT FROM 'object'
       OR NULLIF(BTRIM(v_receipt ->> 'receipt_id'), '') IS NULL
       OR LOWER(COALESCE(v_receipt ->> 'status', '')) NOT IN ('approved', 'passed', 'complete')
       OR (v_receipt ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM v_privacy.content_updated_at
       OR v_receipt ->> 'receipt_id' = ANY(v_seen) THEN
      RAISE EXCEPTION 'Missing, stale, or duplicate % evidence receipt', v_key;
    END IF;
    v_seen := array_append(v_seen, v_receipt ->> 'receipt_id');
  END LOOP;
  IF v_bundle -> 'visual' ->> 'status' IS DISTINCT FROM 'approved'
     OR (v_bundle -> 'visual' ->> 'asset_sha256' IS DISTINCT FROM v_visual_hash
         AND v_bundle -> 'visual' ->> 'receipt_id' NOT LIKE '%' || v_visual_hash)
     OR (v_bundle -> 'visual' ? 'asset_path'
         AND v_bundle -> 'visual' ->> 'asset_path' IS DISTINCT FROM v_item.image_url) THEN
    RAISE EXCEPTION 'Visual approval receipt does not bind the exact asset';
  END IF;

  -- Each stage must have one matching approved predecessor for this candidate.
  FOR v_key IN SELECT unnest(ARRAY['asset_packet', 'visual_review', 'copy_review']) LOOP
    SELECT count(*), (array_agg(id ORDER BY created_at DESC))[1], max(created_at)
      INTO v_count, v_prior_id,
        v_copy_at
    FROM public.social_content_decision_receipts
    WHERE social_content_id = p_social_content_id AND decision = 'approve'
      AND candidate_projection = v_candidate
      AND created_at < v_privacy.created_at
      AND (current_gate = v_key OR (v_key = 'copy_review' AND current_gate = 'copy'));
    IF v_count IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'Missing or ambiguous % canonical decision lineage', v_key;
    END IF;
    SELECT * INTO v_prior FROM public.social_content_decision_receipts WHERE id = v_prior_id;
    FOREACH v_receipt_key IN ARRAY ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'] LOOP
      IF v_prior.receipt_bundle -> v_receipt_key ->> 'receipt_id' IS DISTINCT FROM v_bundle -> v_receipt_key ->> 'receipt_id'
         OR (v_prior.receipt_bundle -> v_receipt_key ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM v_prior.content_updated_at THEN
        RAISE EXCEPTION 'Canonical decision receipt lineage mismatch';
      END IF;
    END LOOP;
    IF v_key = 'asset_packet' THEN v_asset_at := v_copy_at; v_asset_id := v_prior_id;
    ELSIF v_key = 'visual_review' THEN v_visual_at := v_copy_at; v_visual_id := v_prior_id;
    ELSE v_copy_id := v_prior_id;
    END IF;
  END LOOP;
  IF v_copy_at >= v_visual_at OR v_visual_at >= v_asset_at
     OR v_asset_at >= v_privacy.created_at THEN
    RAISE EXCEPTION 'Canonical decision lineage is out of order';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.social_content_decision_receipts
    WHERE social_content_id = p_social_content_id AND candidate_projection = v_candidate
      AND current_gate IN ('copy', 'copy_review') AND decision = 'approve'
      AND command_name = 'approve_copy' AND next_internal_gate = 'visual_review')
     OR NOT EXISTS (SELECT 1 FROM public.social_content_decision_receipts
    WHERE social_content_id = p_social_content_id AND candidate_projection = v_candidate
      AND current_gate = 'visual_review' AND decision = 'approve'
      AND command_name = 'approve_visual_review' AND next_internal_gate = 'asset_packet')
     OR NOT EXISTS (SELECT 1 FROM public.social_content_decision_receipts
    WHERE social_content_id = p_social_content_id AND candidate_projection = v_candidate
      AND current_gate = 'asset_packet' AND decision = 'approve'
      AND command_name = 'approve_asset_packet' AND next_internal_gate = 'privacy') THEN
    RAISE EXCEPTION 'Canonical copy, visual, or asset packet ordering mismatch';
  END IF;

  v_packet := jsonb_build_object(
    'version', 'linkedin_draft_handoff_v2', 'status', 'ready_for_internal_review',
    'platform', 'linkedin', 'created_at', v_now, 'created_by', p_actor_user_id,
    'external_account_draft_created', false, 'external_execution', false,
    'social_content_id', p_social_content_id, 'social_content_href', '/admin/social-content/' || p_social_content_id,
    'source_content_updated_at', p_expected_content_updated_at,
    'privacy_decision_receipt_id', p_privacy_receipt_id,
    'canonical_decision_lineage', jsonb_build_object('copy_receipt_id', v_copy_id, 'visual_review_receipt_id', v_visual_id, 'asset_packet_receipt_id', v_asset_id, 'privacy_receipt_id', p_privacy_receipt_id),
    'candidate_projection', v_candidate, 'evidence_receipts', v_bundle,
    'approved_visual_sha256', v_visual_hash, 'visual_asset', jsonb_build_object('type', 'single_image', 'image_url', v_item.image_url),
    'post_text', v_item.post_text, 'cta_text', v_item.cta_text, 'cta_url', v_item.cta_url,
    'hashtags', v_item.hashtags,
    'delivery_boundary', 'Internal review only. No provider call, external draft, upload, schedule, publish, or send.'
  );
  INSERT INTO public.agent_work_items (
    title, objective, status, priority, owner_agent_key, source_type, source_id,
    source_label, metadata, idempotency_key
  ) VALUES (
    'Review LinkedIn handoff from approved Social Content',
    'Review the exact version-bound copy, visual, asset packet, privacy receipt, and candidate projection. External execution remains closed.',
    'ready_for_review', 'high', 'content-repurposing',
    'social_content_linkedin_draft_handoff', p_social_content_id::TEXT,
    'LinkedIn draft handoff', jsonb_build_object('draft_packet', v_packet, 'external_execution', false), v_idempotency_key
  ) RETURNING * INTO v_work;
  v_packet := v_packet || jsonb_build_object('work_item', jsonb_build_object(
    'id', v_work.id, 'title', v_work.title, 'status', v_work.status, 'owner_agent_key', v_work.owner_agent_key));
  UPDATE public.social_content_queue
  SET rag_context = v_item.rag_context || jsonb_build_object('linkedin_draft_handoff', v_packet),
      updated_at = v_now
  WHERE id = p_social_content_id;
  RETURN jsonb_build_object('handoff', v_packet, 'idempotent_replay', false, 'external_execution', false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_receipt_backed_linkedin_handoff(UUID, TIMESTAMPTZ, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_receipt_backed_linkedin_handoff(UUID, TIMESTAMPTZ, UUID, UUID)
  TO service_role;
