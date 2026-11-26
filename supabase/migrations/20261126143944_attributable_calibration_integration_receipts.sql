-- Phase 5K-A: an approval-bound, internal synthetic review authority receipt.
-- This creates no packet link, policy change, label promotion, or execution path.
BEGIN;

CREATE TABLE public.attributable_calibration_integration_receipts (
  id uuid PRIMARY KEY,
  agent_approval_id uuid NOT NULL UNIQUE REFERENCES public.agent_approvals(id) ON DELETE RESTRICT,
  authority_identity uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  authority_version text NOT NULL CHECK (length(btrim(authority_version)) > 0),
  report_version text NOT NULL CHECK (length(btrim(report_version)) > 0),
  report_sha256 text NOT NULL CHECK (report_sha256 ~ '^[a-f0-9]{64}$'),
  policy_version text NOT NULL CHECK (length(btrim(policy_version)) > 0),
  policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[a-f0-9]{64}$'),
  case_id text NOT NULL CHECK (length(btrim(case_id)) > 0),
  case_version text NOT NULL CHECK (length(btrim(case_version)) > 0),
  case_sha256 text NOT NULL CHECK (case_sha256 ~ '^[a-f0-9]{64}$'),
  artifact_version text NOT NULL CHECK (length(btrim(artifact_version)) > 0),
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_version text NOT NULL CHECK (length(btrim(evidence_version)) > 0),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  content_version text NOT NULL CHECK (length(btrim(content_version)) > 0),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  channel_version text NOT NULL CHECK (length(btrim(channel_version)) > 0),
  channel_sha256 text NOT NULL CHECK (channel_sha256 ~ '^[a-f0-9]{64}$'),
  format_version text NOT NULL CHECK (length(btrim(format_version)) > 0),
  format_sha256 text NOT NULL CHECK (format_sha256 ~ '^[a-f0-9]{64}$'),
  cohort_version text NOT NULL CHECK (length(btrim(cohort_version)) > 0),
  cohort_sha256 text NOT NULL CHECK (cohort_sha256 ~ '^[a-f0-9]{64}$'),
  performance_version text NOT NULL CHECK (length(btrim(performance_version)) > 0),
  performance_sha256 text NOT NULL CHECK (performance_sha256 ~ '^[a-f0-9]{64}$'),
  source_version text NOT NULL CHECK (length(btrim(source_version)) > 0),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  repair_version text NOT NULL CHECK (length(btrim(repair_version)) > 0),
  repair_sha256 text NOT NULL CHECK (repair_sha256 ~ '^[a-f0-9]{64}$'),
  decision text NOT NULL DEFAULT 'allow_synthetic_review_candidate'
    CHECK (decision = 'allow_synthetic_review_candidate'),
  decided_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL CHECK (valid_until > decided_at),
  receipt_sha256 text NOT NULL CHECK (receipt_sha256 ~ '^[a-f0-9]{64}$'),
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object' AND provenance <> '{}'::jsonb),
  rollback_metadata jsonb NOT NULL CHECK (jsonb_typeof(rollback_metadata) = 'object' AND rollback_metadata <> '{}'::jsonb),
  receipt_payload jsonb NOT NULL CHECK (jsonb_typeof(receipt_payload) = 'object'),
  approval_snapshot jsonb NOT NULL CHECK (jsonb_typeof(approval_snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (report_sha256, case_id, case_version, artifact_version, repair_sha256)
);

ALTER TABLE public.attributable_calibration_integration_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attributable_calibration_integration_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.attributable_calibration_integration_receipts TO service_role;

CREATE FUNCTION public.reject_attributable_calibration_integration_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'attributable calibration integration receipts are immutable';
END;
$$;
REVOKE ALL ON FUNCTION public.reject_attributable_calibration_integration_receipt_mutation()
  FROM PUBLIC, anon, authenticated;
CREATE TRIGGER attributable_calibration_integration_receipts_immutable
  BEFORE UPDATE OR DELETE ON public.attributable_calibration_integration_receipts
  FOR EACH ROW EXECUTE FUNCTION public.reject_attributable_calibration_integration_receipt_mutation();

-- The approved parent must carry the exact submitted authority payload in
-- metadata.calibration_integration_authority. A self-asserted hash is not authority.
CREATE FUNCTION public.record_attributable_calibration_integration_receipt(
  p_approval_id uuid, p_receipt jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_approval public.agent_approvals%ROWTYPE;
  v_existing public.attributable_calibration_integration_receipts%ROWTYPE;
  v_inserted public.attributable_calibration_integration_receipts%ROWTYPE;
  v_key text;
  v_dimension text;
  v_dimensions text[] := ARRAY['report','policy','case','artifact','evidence','content',
    'channel','format','cohort','performance','source','repair'];
  v_required text[] := ARRAY[
    'decision_receipt_id','authority_identity','authority_version','decision',
    'report_version','report_sha256','policy_id','policy_version','policy_sha256',
    'policy_approval_receipt_id','case_id','case_version','case_sha256',
    'artifact_version','artifact_sha256','evidence_version','evidence_sha256',
    'content_version','content_sha256','platform','channel','channel_version',
    'channel_sha256','format','format_version','format_sha256','cohort_version',
    'cohort_sha256','performance_version','performance_sha256','source_version',
    'source_sha256','repair_version','repair_sha256',
    'decided_at','valid_until','privacy_cleared','rights_cleared',
    'exclusions','source_path','provenance','rollback_metadata','receipt_sha256'
  ];
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_approval_id IS NULL OR p_receipt IS NULL OR jsonb_typeof(p_receipt) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_receipt)) <> array_length(v_required, 1)
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_receipt) AS key_name
               WHERE NOT key_name = ANY(v_required)) THEN
    RAISE EXCEPTION 'incomplete or unexpected calibration authority payload';
  END IF;
  FOREACH v_key IN ARRAY v_required LOOP
    IF NOT p_receipt ? v_key OR p_receipt->>v_key IS NULL
      OR length(btrim(p_receipt->>v_key)) = 0 THEN
      RAISE EXCEPTION 'missing calibration authority binding: %', v_key;
    END IF;
  END LOOP;
  FOREACH v_dimension IN ARRAY v_dimensions LOOP
    IF jsonb_typeof(p_receipt->(v_dimension || '_version')) <> 'string'
      OR jsonb_typeof(p_receipt->(v_dimension || '_sha256')) <> 'string'
      OR length(btrim(p_receipt->>(v_dimension || '_version'))) = 0
      OR p_receipt->>(v_dimension || '_sha256') !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'invalid calibration authority version/hash pair: %', v_dimension;
    END IF;
  END LOOP;
  IF p_receipt->>'decision' <> 'allow_synthetic_review_candidate'
    OR (p_receipt->>'authority_identity')::uuid IS NULL
    OR p_receipt->>'channel' <> p_receipt->>'platform'
    OR jsonb_typeof(p_receipt->'privacy_cleared') <> 'boolean'
    OR jsonb_typeof(p_receipt->'rights_cleared') <> 'boolean'
    OR p_receipt->>'privacy_cleared' <> 'true'
    OR p_receipt->>'rights_cleared' <> 'true'
    OR jsonb_typeof(p_receipt->'exclusions') <> 'array'
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_receipt->'exclusions') AS item
               WHERE jsonb_typeof(item) <> 'string' OR length(btrim(item #>> '{}')) = 0)
    OR jsonb_typeof(p_receipt->'provenance') <> 'object'
    OR p_receipt->'provenance' = '{}'::jsonb
    OR p_receipt#>>'{provenance,source_path}' IS DISTINCT FROM p_receipt->>'source_path'
    OR jsonb_typeof(p_receipt->'rollback_metadata') <> 'object'
    OR p_receipt->'rollback_metadata' = '{}'::jsonb
    OR left(p_receipt->>'source_path', 1) = '/'
    OR p_receipt->>'source_path' LIKE '%../%'
    OR p_receipt->>'source_path' LIKE '%/..%'
    OR p_receipt->>'receipt_sha256' !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid calibration authority scope or binding';
  END IF;
  IF (p_receipt->>'valid_until')::timestamptz <= v_now
    OR (p_receipt->>'decided_at')::timestamptz > v_now
    OR (p_receipt->>'valid_until')::timestamptz <= (p_receipt->>'decided_at')::timestamptz THEN
    RAISE EXCEPTION 'calibration authority is expired or future-dated';
  END IF;

  SELECT * INTO v_approval FROM public.agent_approvals
    WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND OR v_approval.approval_type <> 'attributable_calibration_integration'
    OR v_approval.status <> 'approved' OR v_approval.decided_by_user_id IS NULL
    OR v_approval.decided_by_user_id IS DISTINCT FROM (p_receipt->>'authority_identity')::uuid
    OR v_approval.decided_at IS NULL
    OR v_approval.decided_at IS DISTINCT FROM (p_receipt->>'decided_at')::timestamptz
    OR v_approval.metadata->'calibration_integration_authority' IS DISTINCT FROM p_receipt THEN
    RAISE EXCEPTION 'parent approval is not the exact approved calibration authority';
  END IF;

  SELECT * INTO v_existing FROM public.attributable_calibration_integration_receipts
    WHERE agent_approval_id = p_approval_id
       OR id = (p_receipt->>'decision_receipt_id')::uuid
       OR (report_sha256 = p_receipt->>'report_sha256'
           AND case_id = p_receipt->>'case_id'
           AND case_version = p_receipt->>'case_version'
           AND artifact_version = p_receipt->>'artifact_version'
           AND repair_sha256 = p_receipt->>'repair_sha256');
  IF FOUND THEN
    IF v_existing.agent_approval_id = p_approval_id AND v_existing.receipt_payload = p_receipt THEN
      RETURN to_jsonb(v_existing) || jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION 'conflicting calibration authority receipt';
  END IF;

  INSERT INTO public.attributable_calibration_integration_receipts (
    id, agent_approval_id, authority_identity, authority_version,
    report_version, report_sha256, policy_version, policy_sha256,
    case_id, case_version, case_sha256, artifact_version, artifact_sha256,
    evidence_version, evidence_sha256, content_version, content_sha256,
    channel_version, channel_sha256, format_version, format_sha256,
    cohort_version, cohort_sha256, performance_version, performance_sha256,
    source_version, source_sha256, repair_version, repair_sha256,
    decision, decided_at, valid_until, receipt_sha256,
    provenance, rollback_metadata, receipt_payload, approval_snapshot
  ) VALUES (
    (p_receipt->>'decision_receipt_id')::uuid, p_approval_id,
    (p_receipt->>'authority_identity')::uuid, p_receipt->>'authority_version',
    p_receipt->>'report_version', p_receipt->>'report_sha256',
    p_receipt->>'policy_version', p_receipt->>'policy_sha256',
    p_receipt->>'case_id', p_receipt->>'case_version', p_receipt->>'case_sha256',
    p_receipt->>'artifact_version', p_receipt->>'artifact_sha256',
    p_receipt->>'evidence_version', p_receipt->>'evidence_sha256',
    p_receipt->>'content_version', p_receipt->>'content_sha256',
    p_receipt->>'channel_version', p_receipt->>'channel_sha256',
    p_receipt->>'format_version', p_receipt->>'format_sha256',
    p_receipt->>'cohort_version', p_receipt->>'cohort_sha256',
    p_receipt->>'performance_version', p_receipt->>'performance_sha256',
    p_receipt->>'source_version', p_receipt->>'source_sha256',
    p_receipt->>'repair_version', p_receipt->>'repair_sha256',
    p_receipt->>'decision', (p_receipt->>'decided_at')::timestamptz,
    (p_receipt->>'valid_until')::timestamptz, p_receipt->>'receipt_sha256',
    p_receipt->'provenance', p_receipt->'rollback_metadata', p_receipt,
    jsonb_build_object('id', v_approval.id,
      'approval_type', v_approval.approval_type, 'status', v_approval.status,
      'decided_by_user_id', v_approval.decided_by_user_id,
      'decided_at', v_approval.decided_at)
  ) RETURNING * INTO v_inserted;
  RETURN to_jsonb(v_inserted) || jsonb_build_object('replayed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.record_attributable_calibration_integration_receipt(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_attributable_calibration_integration_receipt(uuid, jsonb)
  TO service_role;
COMMIT;

-- Rollback only if the table is empty (no audit history to preserve):
-- DROP FUNCTION public.record_attributable_calibration_integration_receipt(uuid, jsonb);
-- DROP TABLE public.attributable_calibration_integration_receipts;
-- DROP FUNCTION public.reject_attributable_calibration_integration_receipt_mutation();
-- If receipts exist, retain the table and revoke the recording function instead:
-- REVOKE EXECUTE ON FUNCTION public.record_attributable_calibration_integration_receipt(uuid, jsonb)
--   FROM service_role;
