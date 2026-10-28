-- Create an initial internal copy-review packet from receipt identities already
-- persisted on the exact Social Content version. No evidence is synthesized.
CREATE OR REPLACE FUNCTION public.prepare_social_content_copy_review(
  p_social_content_id UUID,
  p_expected_content_updated_at TIMESTAMPTZ,
  p_triggered_by_user_id UUID
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
BEGIN
  IF p_triggered_by_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated operator identity is required';
  END IF;

  SELECT * INTO v_item FROM public.social_content_queue
  WHERE id = p_social_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Social Content item not found'; END IF;

  -- A retry uses the packet already bound to this item, even though preparation
  -- itself updated the row timestamp. The approval and work item must still exist.
  v_packet := v_item.rag_context -> 'mobile_decision_review';
  IF v_packet IS NOT NULL THEN
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
  IF v_item.rag_context ->> 'current_gate' IS DISTINCT FROM 'copy_review' THEN
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

  v_projection := v_item.rag_context -> 'copy_review_candidate_projection';
  IF jsonb_typeof(v_projection) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Persisted copy-review candidate projection is required';
  END IF;

  -- The copied receipts and projection retain all source IDs, observed values,
  -- configured thresholds and privacy fields. Only packet binding is new.
  v_idempotency_key := 'social-copy-review:' || p_social_content_id::TEXT || ':' || v_item.updated_at::TEXT;
  v_packet := jsonb_build_object(
    'version', 'social-content-decision-review/v1',
    'approval_id', v_approval_id, 'run_id', v_run_id,
    'work_item_id', v_work_item_id, 'content_id', p_social_content_id,
    'content_updated_at', v_item.updated_at, 'current_gate', 'copy_review',
    'next_gate', 'visual_review', 'receipts', v_receipts,
    'candidate_projection', v_projection
  );
  -- Preparation changes review metadata only. The evidence was approved for
  -- the content version, which remains the packet version.

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
        || jsonb_build_object('status', 'pending', 'content_version', v_item.updated_at,
                              'work_item_id', v_work_item_id)), true)
  WHERE id = v_calendar.id;

  UPDATE public.social_content_queue
  SET rag_context = COALESCE(rag_context, '{}'::JSONB)
        || jsonb_build_object('mobile_decision_review', v_packet),
      updated_at = v_item.updated_at
  WHERE id = p_social_content_id
  RETURNING * INTO v_item;
  IF v_item.updated_at IS DISTINCT FROM p_expected_content_updated_at THEN
    RAISE EXCEPTION 'Social Content version changed during packet preparation';
  END IF;

  RETURN jsonb_build_object(
    'work_item_id', v_work_item_id, 'approval_id', v_approval_id,
    'run_id', v_run_id, 'content_updated_at', v_item.updated_at,
    'current_gate', 'copy_review', 'next_gate', 'visual_review',
    'idempotent_replay', false, 'external_execution', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_social_content_copy_review(UUID, TIMESTAMPTZ, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_social_content_copy_review(UUID, TIMESTAMPTZ, UUID)
  TO service_role;
