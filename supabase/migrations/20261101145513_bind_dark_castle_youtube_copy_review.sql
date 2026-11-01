-- Atomic receipt-backed Dark Castle media binding and first copy-review packet.
-- Create an initial internal copy-review packet from receipt identities already
-- persisted on the exact Social Content version. No evidence is synthesized.
CREATE OR REPLACE FUNCTION public.bind_dark_castle_youtube_copy_review(
  p_social_content_id UUID,
  p_expected_content_updated_at TIMESTAMPTZ,
  p_triggered_by_user_id UUID,
  p_master_sha256 TEXT,
  p_thumbnail_sha256 TEXT,
  p_thumbnail_direction TEXT,
  p_thumbnail_selection_receipt_id TEXT,
  p_description_receipt_id TEXT,
  p_evidence_receipt_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.social_content_queue%ROWTYPE;
  v_calendar public.social_content_calendar_items%ROWTYPE;
  v_calendar_count INTEGER;
  v_receipts JSONB;
  v_source_receipts JSONB;
  v_receipt JSONB;
  v_projection JSONB;
  v_packet JSONB;
  v_key TEXT;
  v_seen_receipt_ids TEXT[] := ARRAY[]::TEXT[];
  v_now TIMESTAMPTZ := clock_timestamp();
  v_run_id UUID := gen_random_uuid();
  v_approval_id UUID := gen_random_uuid();
  v_work_item_id UUID := gen_random_uuid();
  v_idempotency_key TEXT;
  v_evidence_version TIMESTAMPTZ;
  v_prepared_version TIMESTAMPTZ;
  v_description JSONB;
  v_evidence JSONB;
  v_media_binding JSONB;
  v_thumbnail_binding JSONB;
BEGIN
  IF p_triggered_by_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated operator identity is required';
  END IF;

  IF p_social_content_id IS DISTINCT FROM 'c12378f2-36de-4bf7-8c5d-0ce754e727eb'::UUID
     OR p_master_sha256 IS DISTINCT FROM '2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36'
     OR p_thumbnail_sha256 IS DISTINCT FROM '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0'
     OR p_thumbnail_direction IS DISTINCT FROM 'C'
     OR p_thumbnail_selection_receipt_id IS DISTINCT FROM 'human-qa:dark-castle-youtube-master:thumbnail-selection:20261030:v1'
     OR p_description_receipt_id IS DISTINCT FROM 'youtube-description:dark-castle:sha256:224f7d07a4d55a9d'
     OR p_evidence_receipt_id IS DISTINCT FROM 'youtube-description-evidence-reconciliation:fnv1a:07f944bb' THEN
    RAISE EXCEPTION 'Approved artifact identity mismatch';
  END IF;

  SELECT * INTO v_item FROM public.social_content_queue
  WHERE id = p_social_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Social Content item not found'; END IF;
  IF v_item.platform IS DISTINCT FROM 'youtube' OR v_item.status IS DISTINCT FROM 'draft'
     OR v_item.rag_context ->> 'content_version' IS DISTINCT FROM 'sha256:4b4126fe2388687c899530cdb9ee973e744d9e0ebfd2b6378ac6b3702000342a'
     OR NULLIF(BTRIM(v_item.youtube_title), '') IS NULL
     OR NULLIF(BTRIM(v_item.youtube_description), '') IS NULL THEN
    RAISE EXCEPTION 'Canonical content identity, version, status, or copy mismatch';
  END IF;
  v_description := v_item.rag_context -> 'youtube_description_receipt';
  v_evidence := v_item.rag_context -> 'description_evidence_reconciliation_receipt';
  IF v_description ->> 'receipt_id' IS DISTINCT FROM p_description_receipt_id
     OR v_description ->> 'social_content_id' IS DISTINCT FROM p_social_content_id::TEXT
     OR v_description ->> 'content_version' IS DISTINCT FROM v_item.rag_context ->> 'content_version'
     OR v_description ->> 'description_sha256' IS DISTINCT FROM encode(sha256(convert_to(v_item.youtube_description, 'UTF8')), 'hex')
     OR v_description ->> 'human_qa_status' IS DISTINCT FROM 'pending'
     OR v_evidence ->> 'receipt_id' IS DISTINCT FROM p_evidence_receipt_id
     OR v_evidence ->> 'social_content_id' IS DISTINCT FROM p_social_content_id::TEXT
     OR v_evidence ->> 'content_version' IS DISTINCT FROM v_item.rag_context ->> 'content_version'
     OR v_evidence ->> 'status' IS DISTINCT FROM 'passed'
     OR v_evidence ->> 'evidence_input_fingerprint' IS DISTINCT FROM v_description ->> 'evidence_input_fingerprint' THEN
    RAISE EXCEPTION 'Description or evidence reconciliation receipt is missing, stale, or mismatched';
  END IF;
  v_media_binding := jsonb_build_object('version', 'dark-castle-youtube-master-binding/v1',
    'social_content_id', p_social_content_id, 'content_version', v_item.rag_context ->> 'content_version',
    'path', '/review-assets/social-content/dark-castle-youtube-master-2026-10-29/dark-castle-youtube-master.mp4',
    'sha256', p_master_sha256, 'description_receipt_id', p_description_receipt_id,
    'evidence_receipt_id', p_evidence_receipt_id, 'external_execution', false);
  v_thumbnail_binding := jsonb_build_object('version', 'youtube-thumbnail-human-qa-selection/v1',
    'receipt_id', p_thumbnail_selection_receipt_id, 'social_content_id', p_social_content_id,
    'content_version', v_item.rag_context ->> 'content_version', 'direction', p_thumbnail_direction,
    'path', '/review-assets/social-content/dark-castle-youtube-master-2026-10-29/03-accidental-success-v2.png',
    'sha256', p_thumbnail_sha256);
  IF v_item.video_url IS NOT NULL AND v_item.video_url IS DISTINCT FROM v_media_binding ->> 'path'
     OR v_item.image_url IS NOT NULL AND v_item.image_url IS DISTINCT FROM v_thumbnail_binding ->> 'path' THEN
    RAISE EXCEPTION 'Existing canonical media points to a different asset';
  END IF;
  IF v_item.rag_context ? 'dark_castle_master_binding'
     AND v_item.rag_context -> 'dark_castle_master_binding' IS DISTINCT FROM v_media_binding
     OR v_item.rag_context ? 'dark_castle_thumbnail_binding'
     AND v_item.rag_context -> 'dark_castle_thumbnail_binding' IS DISTINCT FROM v_thumbnail_binding THEN
    RAISE EXCEPTION 'Existing canonical media binding is ambiguous';
  END IF;

  -- A retry uses the packet already bound to this item, even though preparation
  -- itself updated the row timestamp. The approval and work item must still exist.
  v_packet := v_item.rag_context -> 'mobile_decision_review';
  IF v_packet IS NOT NULL THEN
    IF v_item.video_url IS DISTINCT FROM v_media_binding ->> 'path'
       OR v_item.image_url IS DISTINCT FROM v_thumbnail_binding ->> 'path'
       OR v_item.rag_context -> 'dark_castle_master_binding' IS DISTINCT FROM v_media_binding
       OR v_item.rag_context -> 'dark_castle_thumbnail_binding' IS DISTINCT FROM v_thumbnail_binding THEN
      RAISE EXCEPTION 'Existing copy packet lacks the exact approved media binding';
    END IF;
    IF v_packet ->> 'version' = 'social-content-decision-review/v1'
       AND v_packet ->> 'current_gate' = 'copy_review'
       AND v_packet ->> 'content_id' = p_social_content_id::TEXT
       AND (v_packet ->> 'content_updated_at')::TIMESTAMPTZ = v_item.updated_at
       AND EXISTS (SELECT 1 FROM public.agent_approvals a
                   WHERE a.id::TEXT = v_packet ->> 'approval_id'
                     AND a.run_id::TEXT = v_packet ->> 'run_id'
                     AND a.status = 'pending')
       AND EXISTS (SELECT 1 FROM public.agent_work_items w
                   WHERE w.id::TEXT = v_packet ->> 'work_item_id'
                     AND w.approval_id::TEXT = v_packet ->> 'approval_id') THEN
      RETURN jsonb_build_object(
        'work_item_id', v_packet ->> 'work_item_id',
        'approval_id', v_packet ->> 'approval_id',
        'run_id', v_packet ->> 'run_id',
        'content_updated_at', v_item.updated_at,
        'current_gate', 'copy_review',
        'next_gate', 'visual_review',
        'idempotent_replay', true,
        'external_execution', false
      );
    END IF;
    RAISE EXCEPTION 'An existing Decision Queue packet is stale or already bound to another gate';
  END IF;

  IF v_item.updated_at IS DISTINCT FROM p_expected_content_updated_at THEN
    RAISE EXCEPTION 'Social Content version mismatch; reload before preparation';
  END IF;
  IF COALESCE(v_item.rag_context ->> 'current_gate', 'copy_review') IS DISTINCT FROM 'copy_review' THEN
    RAISE EXCEPTION 'Social Content current gate must be copy_review';
  END IF;

  -- Calendar identity is an exact foreign-key binding. Metadata-only matches
  -- could silently select an unrelated imported calendar row.
  SELECT COUNT(*) INTO v_calendar_count FROM public.social_content_calendar_items
  WHERE social_content_id = p_social_content_id;
  IF v_calendar_count <> 1 THEN
    RAISE EXCEPTION 'Exactly one linked calendar identity is required; found %', v_calendar_count;
  END IF;
  SELECT * INTO v_calendar FROM public.social_content_calendar_items
  WHERE social_content_id = p_social_content_id FOR UPDATE;
  IF v_calendar.due_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Linked calendar item is already completed or cancelled';
  END IF;
  IF jsonb_typeof(v_calendar.metadata) IS DISTINCT FROM 'object'
     OR (v_calendar.metadata ? 'social_content_lifecycle'
         AND jsonb_typeof(v_calendar.metadata -> 'social_content_lifecycle') IS DISTINCT FROM 'object')
     OR (v_calendar.metadata #> '{social_content_lifecycle,copy_review}' IS NOT NULL
         AND jsonb_typeof(v_calendar.metadata #> '{social_content_lifecycle,copy_review}') IS DISTINCT FROM 'object') THEN
    RAISE EXCEPTION 'Linked calendar review metadata is malformed';
  END IF;

  v_receipts := v_item.rag_context -> 'copy_review_evidence_receipts';
  IF jsonb_typeof(v_receipts) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Persisted copy-review evidence receipt bundle is required';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'] LOOP
    v_receipt := v_receipts -> v_key;
    IF jsonb_typeof(v_receipt) IS DISTINCT FROM 'object'
       OR NULLIF(BTRIM(v_receipt ->> 'receipt_id'), '') IS NULL THEN
      RAISE EXCEPTION 'Persisted % receipt identity is missing', v_key;
    END IF;
    IF LOWER(COALESCE(v_receipt ->> 'status', '')) NOT IN ('approved', 'passed', 'complete') THEN
      RAISE EXCEPTION 'Persisted % receipt is not approved', v_key;
    END IF;
    IF NULLIF(v_receipt ->> 'content_updated_at', '') IS NULL
       OR (v_receipt ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM v_item.updated_at THEN
      RAISE EXCEPTION 'Persisted % receipt version mismatch', v_key;
    END IF;
    IF v_receipt ->> 'receipt_id' = ANY(v_seen_receipt_ids) THEN
      RAISE EXCEPTION 'Ambiguous copy-review receipt identity for %', v_key;
    END IF;
    v_seen_receipt_ids := array_append(v_seen_receipt_ids, v_receipt ->> 'receipt_id');
  END LOOP;
  IF v_receipts -> 'visual' ->> 'status' IS DISTINCT FROM 'approved'
     OR v_receipts -> 'visual' ->> 'asset_sha256' IS DISTINCT FROM 'sha256:' || p_thumbnail_sha256
     OR v_receipts -> 'visual' ->> 'asset_path' IS DISTINCT FROM v_thumbnail_binding ->> 'path' THEN
    RAISE EXCEPTION 'Approved visual receipt must bind the exact Direction C asset';
  END IF;
  IF v_item.rag_context ? 'approved_visual_sha256'
     AND v_item.rag_context ->> 'approved_visual_sha256' IS DISTINCT FROM 'sha256:' || p_thumbnail_sha256 THEN
    RAISE EXCEPTION 'Existing approved visual hash is ambiguous';
  END IF;

  v_projection := jsonb_build_object(
    'post_text', v_item.post_text, 'cta_text', v_item.cta_text, 'cta_url', v_item.cta_url,
    'youtube_title', v_item.youtube_title, 'youtube_description', v_item.youtube_description,
    'video_url', v_media_binding ->> 'path', 'media_sha256', p_master_sha256,
    'image_url', v_thumbnail_binding ->> 'path', 'visual_sha256', 'sha256:' || p_thumbnail_sha256,
    'thumbnail_direction', p_thumbnail_direction,
    'thumbnail_selection_receipt_id', p_thumbnail_selection_receipt_id,
    'description_receipt_id', p_description_receipt_id,
    'evidence_receipt_id', p_evidence_receipt_id);
  IF v_item.rag_context ? 'copy_review_candidate_projection'
     AND v_item.rag_context -> 'copy_review_candidate_projection' IS DISTINCT FROM v_projection THEN
    RAISE EXCEPTION 'Existing copy-review candidate projection is ambiguous';
  END IF;

  v_evidence_version := v_item.updated_at;
  v_source_receipts := v_receipts;
  v_idempotency_key := 'social-copy-review:' || p_social_content_id::TEXT || ':' || v_evidence_version::TEXT;

  -- The queue has a BEFORE UPDATE trigger that assigns NEW.updated_at = NOW().
  -- Read the actual trigger-produced version before constructing any packet.
  -- NOW() is transaction-stable, so the final metadata update must return the
  -- same version; otherwise the entire transaction rolls back.
  UPDATE public.social_content_queue
  SET video_url = v_media_binding ->> 'path', image_url = v_thumbnail_binding ->> 'path',
      rag_context = v_item.rag_context || jsonb_build_object(
        'dark_castle_master_binding', v_media_binding,
        'dark_castle_thumbnail_binding', v_thumbnail_binding,
        'approved_visual_sha256', 'sha256:' || p_thumbnail_sha256,
        'copy_review_candidate_projection', v_projection,
        'current_gate', 'copy_review'),
      updated_at = now()
  WHERE id = p_social_content_id
  RETURNING updated_at INTO v_prepared_version;
  IF v_prepared_version <= v_evidence_version THEN
    RAISE EXCEPTION 'Social Content version did not advance during packet preparation';
  END IF;

  -- Preserve the exact approved receipt bundle separately. The packet's copy
  -- carries the same IDs and evidence fields with only its version rebound to
  -- the trigger-produced review version expected by canonical decisions.
  FOREACH v_key IN ARRAY ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'] LOOP
    v_receipts := jsonb_set(v_receipts, ARRAY[v_key, 'content_updated_at'], to_jsonb(v_prepared_version));
  END LOOP;
  v_packet := jsonb_build_object(
    'version', 'social-content-decision-review/v1',
    'approval_id', v_approval_id, 'run_id', v_run_id,
    'work_item_id', v_work_item_id, 'content_id', p_social_content_id,
    'content_updated_at', v_prepared_version, 'current_gate', 'copy_review',
    'next_gate', 'visual_review', 'receipts', v_receipts,
    'source_receipts', v_source_receipts,
    'source_content_updated_at', v_evidence_version,
    'candidate_projection', v_projection
  );

  INSERT INTO public.agent_runs (
    id, agent_key, runtime, kind, title, status, subject_type, subject_id,
    subject_label, current_step, trigger_source, triggered_by_user_id,
    metadata, idempotency_key, updated_at
  ) VALUES (
    v_run_id, 'chief-of-staff', 'manual', 'social_content_review',
    'Social Content copy review', 'waiting_for_approval',
    'social_content_internal_review', p_social_content_id::TEXT,
    'Social Content', 'Awaiting canonical copy review decision',
    'portfolio_operator', p_triggered_by_user_id,
    jsonb_build_object('review_packet', v_packet, 'external_execution', false),
    v_idempotency_key || ':run', v_now
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
    v_work_item_id, 'Review Social Content copy packet',
    'Review the exact version-bound packet and record one canonical internal decision.',
    'ready_for_review', 'high', 'chief-of-staff', 'manual',
    'social_content_internal_review', p_social_content_id::TEXT, 'Social Content',
    v_run_id, v_run_id, 'social-content-review',
    'Six persisted approved evidence receipts are bound to the current copy version; external execution remains disabled.',
    v_approval_id,
    jsonb_build_object('review_packet', v_packet, 'recommendation', 'Review the copy packet.',
                       'risk', 'high', 'external_execution', false),
    v_idempotency_key, v_now
  );

  UPDATE public.social_content_calendar_items
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::JSONB), '{social_content_lifecycle}',
    COALESCE(metadata -> 'social_content_lifecycle', '{}'::JSONB)
      || jsonb_build_object('social_content_status', 'pending', 'copy_review',
        COALESCE(metadata #> '{social_content_lifecycle,copy_review}', '{}'::JSONB)
        || jsonb_build_object('status', 'pending', 'content_version', v_prepared_version,
                              'work_item_id', v_work_item_id)), true)
  WHERE id = v_calendar.id;

  UPDATE public.social_content_queue
  SET rag_context = COALESCE(rag_context, '{}'::JSONB)
        || jsonb_build_object('mobile_decision_review', v_packet),
      updated_at = v_prepared_version
  WHERE id = p_social_content_id
  RETURNING * INTO v_item;
  IF v_item.updated_at IS DISTINCT FROM v_prepared_version THEN
    RAISE EXCEPTION 'Social Content version changed after packet binding';
  END IF;

  RETURN jsonb_build_object(
    'work_item_id', v_work_item_id, 'approval_id', v_approval_id,
    'run_id', v_run_id, 'content_updated_at', v_prepared_version,
    'current_gate', 'copy_review', 'next_gate', 'visual_review',
    'idempotent_replay', false, 'external_execution', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bind_dark_castle_youtube_copy_review(UUID, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_dark_castle_youtube_copy_review(UUID, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;
