-- Mobile Social Decision Receipts
--
-- Adds an append-only audit receipt and one transactional command for the
-- existing Agent Ops approval + Social Content workflow. The command advances
-- internal review state only. It cannot render media, upload, schedule,
-- publish, send, or call an external provider.

CREATE TABLE IF NOT EXISTS public.social_content_decision_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_content_id UUID NOT NULL REFERENCES public.social_content_queue(id) ON DELETE RESTRICT,
  agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE RESTRICT,
  agent_approval_id UUID NOT NULL REFERENCES public.agent_approvals(id) ON DELETE RESTRICT,
  agent_work_item_id UUID NOT NULL REFERENCES public.agent_work_items(id) ON DELETE RESTRICT,
  content_updated_at TIMESTAMPTZ NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'request_revision', 'hold')),
  decided_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  current_gate TEXT NOT NULL,
  next_internal_gate TEXT NOT NULL,
  receipt_bundle JSONB NOT NULL,
  candidate_projection JSONB,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT social_content_decision_receipt_bundle_object
    CHECK (jsonb_typeof(receipt_bundle) = 'object'),
  CONSTRAINT social_content_decision_candidate_projection_object
    CHECK (candidate_projection IS NULL OR jsonb_typeof(candidate_projection) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_social_content_decision_receipts_content_created
  ON public.social_content_decision_receipts (social_content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_content_decision_receipts_approval
  ON public.social_content_decision_receipts (agent_approval_id, created_at DESC);

ALTER TABLE public.social_content_decision_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.social_content_decision_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.social_content_decision_receipts TO service_role;

COMMENT ON TABLE public.social_content_decision_receipts IS
  'Append-only, version-bound internal Social Content decisions. Rows are audit receipts and never authorize external execution.';

CREATE OR REPLACE FUNCTION public.prevent_social_content_decision_receipt_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'social_content_decision_receipts are immutable';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_social_content_decision_receipt_mutation() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS prevent_social_content_decision_receipt_mutation
  ON public.social_content_decision_receipts;
CREATE TRIGGER prevent_social_content_decision_receipt_mutation
  BEFORE UPDATE OR DELETE ON public.social_content_decision_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_social_content_decision_receipt_mutation();

CREATE OR REPLACE FUNCTION public.record_social_content_decision(
  p_social_content_id UUID,
  p_approval_id UUID,
  p_content_updated_at TIMESTAMPTZ,
  p_decision TEXT,
  p_decided_by_user_id UUID,
  p_idempotency_key TEXT
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
  v_packet JSONB;
  v_receipts JSONB;
  v_receipt public.social_content_decision_receipts%ROWTYPE;
  v_key TEXT;
  v_current_gate TEXT;
  v_next_gate TEXT;
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
    RETURN jsonb_build_object(
      'id', v_receipt.id,
      'decision', v_receipt.decision,
      'content_updated_at', v_receipt.content_updated_at,
      'next_internal_gate', v_receipt.next_internal_gate,
      'created_at', v_receipt.created_at,
      'idempotent_replay', true,
      'external_execution', false
    );
  END IF;

  SELECT * INTO v_item
  FROM public.social_content_queue
  WHERE id = p_social_content_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Social Content item not found';
  END IF;

  -- Recheck after the item lock so two simultaneous taps collapse to the
  -- receipt committed by the first transaction instead of reporting stale.
  SELECT * INTO v_receipt
  FROM public.social_content_decision_receipts
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_receipt.id,
      'decision', v_receipt.decision,
      'content_updated_at', v_receipt.content_updated_at,
      'next_internal_gate', v_receipt.next_internal_gate,
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Central Decision Queue approval not found';
  END IF;
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

  FOREACH v_key IN ARRAY ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']
  LOOP
    IF jsonb_typeof(v_receipts -> v_key) <> 'object'
       OR NULLIF(BTRIM(v_receipts -> v_key ->> 'receipt_id'), '') IS NULL
       OR LOWER(COALESCE(v_receipts -> v_key ->> 'status', '')) NOT IN ('approved', 'passed', 'complete')
       OR (v_receipts -> v_key ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM p_content_updated_at THEN
      RAISE EXCEPTION '% receipt is missing, failed, or stale', INITCAP(v_key);
    END IF;
  END LOOP;

  SELECT * INTO v_run
  FROM public.agent_runs
  WHERE id = v_approval.run_id
    AND subject_type = 'social_content_internal_review'
    AND subject_id = p_social_content_id::TEXT
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent Ops run is not bound to this Social Content item';
  END IF;

  SELECT * INTO v_work_item
  FROM public.agent_work_items
  WHERE id = (v_packet ->> 'work_item_id')::UUID
    AND active_run_id = v_run.id
    AND approval_id = v_approval.id
    AND source_type = 'social_content_internal_review'
    AND source_id = p_social_content_id::TEXT
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Decision Queue work item is not bound to this review packet';
  END IF;

  v_current_gate := v_packet ->> 'current_gate';
  v_next_gate := CASE
    WHEN p_decision = 'approve' THEN v_packet ->> 'next_gate'
    WHEN p_decision = 'request_revision' THEN 'copy_revision'
    ELSE v_current_gate
  END;
  IF NULLIF(BTRIM(v_current_gate), '') IS NULL OR NULLIF(BTRIM(v_next_gate), '') IS NULL THEN
    RAISE EXCEPTION 'Review packet gate binding is incomplete';
  END IF;

  INSERT INTO public.social_content_decision_receipts (
    social_content_id,
    agent_run_id,
    agent_approval_id,
    agent_work_item_id,
    content_updated_at,
    decision,
    decided_by_user_id,
    current_gate,
    next_internal_gate,
    receipt_bundle,
    candidate_projection,
    idempotency_key
  ) VALUES (
    p_social_content_id,
    v_run.id,
    v_approval.id,
    v_work_item.id,
    p_content_updated_at,
    p_decision,
    p_decided_by_user_id,
    v_current_gate,
    v_next_gate,
    v_receipts,
    v_packet -> 'candidate_projection',
    p_idempotency_key
  )
  RETURNING * INTO v_receipt;

  IF p_decision = 'approve' THEN
    UPDATE public.social_content_queue
    SET status = 'approved',
        reviewed_by = p_decided_by_user_id,
        rag_context = COALESCE(rag_context, '{}'::JSONB) || jsonb_build_object(
          'current_gate', v_next_gate,
          'latest_internal_decision_receipt_id', v_receipt.id,
          'latest_internal_decision', p_decision
        )
    WHERE id = p_social_content_id;
  ELSIF p_decision = 'request_revision' THEN
    UPDATE public.social_content_queue
    SET status = 'rejected',
        reviewed_by = p_decided_by_user_id,
        rag_context = COALESCE(rag_context, '{}'::JSONB) || jsonb_build_object(
          'current_gate', 'copy_revision',
          'latest_internal_decision_receipt_id', v_receipt.id,
          'latest_internal_decision', p_decision
        )
    WHERE id = p_social_content_id;
  END IF;

  UPDATE public.agent_approvals
  SET status = CASE
        WHEN p_decision = 'approve' THEN 'approved'
        WHEN p_decision = 'request_revision' THEN 'rejected'
        ELSE status
      END,
      decided_by_user_id = CASE WHEN p_decision = 'hold' THEN NULL ELSE p_decided_by_user_id END,
      decided_at = CASE WHEN p_decision = 'hold' THEN NULL ELSE clock_timestamp() END,
      decision_notes = CASE
        WHEN p_decision = 'approve' THEN 'Approved for the next internal review gate only.'
        WHEN p_decision = 'request_revision' THEN 'Returned to the internal copy revision gate.'
        ELSE 'Held in the central Decision Queue; no later gate or external action authorized.'
      END,
      metadata = metadata || jsonb_build_object(
        'latest_decision_receipt_id', v_receipt.id,
        'latest_decision', p_decision,
        'external_execution', false
      )
  WHERE id = v_approval.id;

  UPDATE public.agent_work_items
  SET status = CASE WHEN p_decision = 'hold' THEN 'blocked' ELSE 'assigned' END,
      blocker_summary = CASE
        WHEN p_decision = 'hold' THEN 'Held by the reviewer in the central Decision Queue.'
        ELSE NULL
      END,
      validation_summary = CASE
        WHEN p_decision = 'approve' THEN 'Approved for the next internal review gate only; no external execution authorized.'
        WHEN p_decision = 'request_revision' THEN 'Returned to the internal copy revision gate; no external execution authorized.'
        ELSE 'Held without advancing the review packet or authorizing external execution.'
      END,
      metadata = metadata || jsonb_build_object(
        'latest_decision_receipt_id', v_receipt.id,
        'latest_decision', p_decision,
        'next_internal_gate', v_next_gate,
        'external_execution', false
      ),
      updated_at = clock_timestamp()
  WHERE id = v_work_item.id;

  UPDATE public.agent_runs
  SET status = CASE WHEN p_decision = 'hold' THEN 'waiting_for_approval' ELSE 'running' END,
      current_step = CASE
        WHEN p_decision = 'approve' THEN 'Internal gate advanced: ' || v_next_gate
        WHEN p_decision = 'request_revision' THEN 'Internal copy revision requested'
        ELSE 'Decision held by reviewer'
      END,
      error_message = NULL,
      updated_at = clock_timestamp()
  WHERE id = v_run.id;

  INSERT INTO public.agent_run_events (
    run_id,
    event_type,
    severity,
    message,
    metadata,
    idempotency_key
  ) VALUES (
    v_run.id,
    'social_content_decision_recorded',
    CASE WHEN p_decision = 'request_revision' THEN 'warning' ELSE 'info' END,
    'Social Content decision: ' || p_decision,
    jsonb_build_object(
      'receipt_id', v_receipt.id,
      'social_content_id', p_social_content_id,
      'decision', p_decision,
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
    'created_at', v_receipt.created_at,
    'idempotent_replay', false,
    'external_execution', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_social_content_decision(UUID, UUID, TIMESTAMPTZ, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_social_content_decision(UUID, UUID, TIMESTAMPTZ, TEXT, UUID, TEXT)
  TO service_role;
