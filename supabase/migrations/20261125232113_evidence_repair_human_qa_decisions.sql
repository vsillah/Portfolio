-- Review-only evidence repair decisions. This migration creates private state;
-- it does not link sources, change Social Content, or enable external execution.
BEGIN;
CREATE TABLE public.evidence_repair_human_qa_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL,
  packet_id uuid NOT NULL REFERENCES public.social_content_research_packets(id) ON DELETE RESTRICT,
  packet_version timestamptz NOT NULL,
  original_packet_id uuid NOT NULL REFERENCES public.social_content_research_packets(id) ON DELETE RESTRICT,
  original_packet_version timestamptz NOT NULL,
  calendar_item_id uuid NOT NULL REFERENCES public.social_content_calendar_items(id) ON DELETE RESTRICT,
  social_content_id uuid NOT NULL REFERENCES public.social_content_queue(id) ON DELETE RESTRICT,
  content_version timestamptz NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve', 'reject', 'revise')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  reviewer_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  surface text NOT NULL CHECK (surface IN ('portfolio', 'slack')),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_expires_at timestamptz NOT NULL,
  approved_copy_sha256 text NOT NULL CHECK (approved_copy_sha256 ~ '^[a-f0-9]{64}$'),
  claim_boundary_sha256 text NOT NULL CHECK (claim_boundary_sha256 ~ '^[a-f0-9]{64}$'),
  candidate_snapshot jsonb NOT NULL,
  freshness_snapshot jsonb NOT NULL,
  slack_identity jsonb,
  idempotency_key text NOT NULL UNIQUE,
  external_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_execution_enabled = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (packet_id, packet_version)
);

ALTER TABLE public.evidence_repair_human_qa_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evidence_repair_human_qa_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.evidence_repair_human_qa_receipts TO service_role;

CREATE FUNCTION public.reject_evidence_repair_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'evidence_repair_human_qa_receipts are immutable';
END;
$$;
CREATE TRIGGER evidence_repair_receipts_immutable
  BEFORE UPDATE OR DELETE ON public.evidence_repair_human_qa_receipts
  FOR EACH ROW EXECUTE FUNCTION public.reject_evidence_repair_receipt_mutation();

-- Service-role only. The caller authenticates the Portfolio admin or maps an
-- allowlisted Slack user to an admin profile before entering this transaction.
CREATE FUNCTION public.record_evidence_repair_human_qa_decision(
  p_packet_id uuid,
  p_packet_version timestamptz,
  p_candidate jsonb,
  p_freshness jsonb,
  p_pattern jsonb,
  p_claim_boundary_sha256 text,
  p_content_version timestamptz,
  p_decision text,
  p_reason text,
  p_reviewer_id uuid,
  p_surface text,
  p_idempotency_key text,
  p_slack_identity jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_packet public.social_content_research_packets%ROWTYPE;
  v_original public.social_content_research_packets%ROWTYPE;
  v_calendar public.social_content_calendar_items%ROWTYPE;
  v_social public.social_content_queue%ROWTYPE;
  v_prior public.evidence_repair_human_qa_receipts%ROWTYPE;
  v_receipt public.evidence_repair_human_qa_receipts%ROWTYPE;
  v_case_id text;
  v_calendar_id uuid;
  v_social_id uuid;
  v_original_id uuid;
  v_source_hash text;
  v_copy_hash text;
  v_next_status text;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject', 'revise')
    OR p_surface IS NULL OR p_surface NOT IN ('portfolio', 'slack')
    OR length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 1 AND 2000
    OR length(coalesce(p_idempotency_key, '')) NOT BETWEEN 16 AND 300
    OR p_candidate IS NULL OR p_freshness IS NULL OR p_pattern IS NULL
    OR coalesce(p_claim_boundary_sha256,'') !~ '^[a-f0-9]{64}$'
    OR p_content_version IS NULL
    OR (p_surface = 'slack' AND (p_slack_identity IS NULL
      OR coalesce(p_slack_identity->>'team_id','') = ''
      OR coalesce(p_slack_identity->>'channel_id','') = ''
      OR coalesce(p_slack_identity->>'message_ts','') = ''
      OR coalesce(p_slack_identity->>'user_id','') = ''))
    OR (p_surface = 'portfolio' AND p_slack_identity IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid evidence repair decision input';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_reviewer_id AND role = 'admin') THEN
    RAISE EXCEPTION 'evidence repair reviewer is not an admin';
  END IF;

  SELECT * INTO v_prior FROM public.evidence_repair_human_qa_receipts
    WHERE packet_id = p_packet_id AND packet_version = p_packet_version;
  IF FOUND THEN
    IF v_prior.idempotency_key = p_idempotency_key AND v_prior.decision = p_decision
      AND v_prior.reason = btrim(p_reason) AND v_prior.reviewer_id = p_reviewer_id
      AND v_prior.surface = p_surface AND v_prior.candidate_snapshot = p_candidate
      AND v_prior.freshness_snapshot = p_freshness
      AND v_prior.claim_boundary_sha256 = p_claim_boundary_sha256
      AND v_prior.content_version = p_content_version
      AND v_prior.slack_identity IS NOT DISTINCT FROM p_slack_identity THEN
      RETURN to_jsonb(v_prior) || jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION 'evidence repair candidate already decided for this version';
  END IF;

  SELECT * INTO v_packet FROM public.social_content_research_packets
    WHERE id = p_packet_id FOR UPDATE;
  -- Check again after the packet lock: concurrent decisions serialize here.
  SELECT * INTO v_prior FROM public.evidence_repair_human_qa_receipts
    WHERE packet_id = p_packet_id AND packet_version = p_packet_version;
  IF FOUND THEN
    IF v_prior.idempotency_key = p_idempotency_key AND v_prior.decision = p_decision
      AND v_prior.reason = btrim(p_reason) AND v_prior.reviewer_id = p_reviewer_id
      AND v_prior.surface = p_surface AND v_prior.candidate_snapshot = p_candidate
      AND v_prior.freshness_snapshot = p_freshness
      AND v_prior.claim_boundary_sha256 = p_claim_boundary_sha256
      AND v_prior.content_version = p_content_version
      AND v_prior.slack_identity IS NOT DISTINCT FROM p_slack_identity THEN
      RETURN to_jsonb(v_prior) || jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION 'evidence repair candidate already decided for this version';
  END IF;
  IF v_packet.id IS NULL OR v_packet.updated_at <> p_packet_version OR v_packet.status <> 'review_ready'
    OR v_packet.actor_metadata->'evidence_repair_candidate' IS DISTINCT FROM p_candidate
    OR v_packet.actor_metadata->'source_freshness_receipt' IS DISTINCT FROM p_freshness
    OR v_packet.pattern_packet IS DISTINCT FROM p_pattern THEN
    RAISE EXCEPTION 'evidence repair packet version or evidence changed';
  END IF;
  IF p_candidate->>'candidate_status' IS DISTINCT FROM 'human_qa_pending'
    OR p_candidate->>'linkage_status' IS DISTINCT FROM 'unlinked'
    OR p_candidate->>'preparation_rerun_status' IS DISTINCT FROM 'not_run'
    OR p_candidate->>'external_actions_allowed' IS DISTINCT FROM 'false'
    OR p_candidate->>'approved_social_copy_unchanged' IS DISTINCT FROM 'true'
    OR p_freshness->>'status' IS DISTINCT FROM 'passed'
    OR p_freshness->>'provenance_status' IS DISTINCT FROM 'verified_primary_source'
    OR p_freshness#>>'{privacy_clearance,status}' IS DISTINCT FROM 'cleared'
    OR p_freshness#>>'{rights_clearance,status}' IS DISTINCT FROM 'cleared_for_bounded_claim_support'
    OR p_freshness->>'source_url' IS DISTINCT FROM v_packet.source_url
    OR coalesce(p_freshness->>'source_url','') !~ '^https://[^[:space:]]+$'
    OR coalesce(btrim(p_pattern->>'source_use_boundary'),'') = ''
    OR (CASE WHEN jsonb_typeof(p_pattern->'supported_claims') = 'array'
      THEN jsonb_array_length(p_pattern->'supported_claims') = 0 ELSE true END)
    OR coalesce(p_freshness->>'source_sha256','') !~ '^[a-f0-9]{64}$'
    OR coalesce(p_candidate->>'approved_social_copy_sha256','') !~ '^[a-f0-9]{64}$'
    OR nullif(p_freshness->>'expires_at','') IS NULL
    OR (p_freshness->>'expires_at')::timestamptz <= clock_timestamp()
    OR nullif(p_freshness->>'observed_at','') IS NULL
    OR (p_freshness->>'observed_at')::timestamptz > clock_timestamp()
    OR nullif(p_freshness->>'evidence_version','')::timestamptz IS DISTINCT FROM v_packet.updated_at THEN
    RAISE EXCEPTION 'evidence repair candidate is stale or outside review-only scope';
  END IF;

  v_calendar_id := (p_candidate->>'calendar_item_id')::uuid;
  v_social_id := (p_candidate->>'social_content_id')::uuid;
  v_original_id := (p_candidate->>'original_packet_id')::uuid;
  SELECT * INTO v_original FROM public.social_content_research_packets
    WHERE id = v_original_id FOR SHARE;
  SELECT * INTO v_calendar FROM public.social_content_calendar_items
    WHERE id = v_calendar_id FOR SHARE;
  SELECT * INTO v_social FROM public.social_content_queue
    WHERE id = v_social_id FOR SHARE;
  IF v_original.id IS NULL OR v_original.updated_at <> (p_candidate->>'original_packet_version')::timestamptz
    OR v_original.status IS DISTINCT FROM 'approved'
    OR v_original.source_url IS DISTINCT FROM (p_candidate->>'original_source_url')
    OR v_calendar.id IS NULL OR v_calendar.social_content_id <> v_social_id
    OR v_calendar.authorization_status IS DISTINCT FROM 'authorized'
    OR EXISTS (SELECT 1 FROM jsonb_each_text(coalesce(v_calendar.metadata, '{}'::jsonb)) AS flag(key, value)
      WHERE flag.key IN ('external_execution_enabled', 'provider_generation_enabled',
        'upload_enabled', 'schedule_enabled', 'publish_enabled', 'outreach_send_enabled')
      AND flag.value IS DISTINCT FROM 'false')
    OR v_social.id IS NULL OR v_social.updated_at IS DISTINCT FROM p_content_version
    OR encode(extensions.digest(convert_to(coalesce(v_social.post_text,''),'UTF8'),'sha256'),'hex')
      <> p_candidate->>'approved_social_copy_sha256' THEN
    RAISE EXCEPTION 'evidence repair original, calendar, or approved copy changed';
  END IF;

  v_case_id := 'calendar:' || v_calendar_id::text || ':repair-packet:' || p_packet_id::text;
  v_source_hash := p_freshness->>'source_sha256';
  v_copy_hash := p_candidate->>'approved_social_copy_sha256';
  v_next_status := CASE p_decision WHEN 'approve' THEN 'human_qa_approved'
    WHEN 'reject' THEN 'human_qa_rejected' ELSE 'revision_requested' END;
  UPDATE public.social_content_research_packets
    SET actor_metadata = jsonb_set(v_packet.actor_metadata,
      '{evidence_repair_candidate,candidate_status}', to_jsonb(v_next_status), false),
      updated_at = greatest(clock_timestamp(), v_packet.updated_at + interval '1 microsecond')
    WHERE id = p_packet_id AND updated_at = p_packet_version
      AND actor_metadata->'evidence_repair_candidate' = p_candidate
      AND actor_metadata->'source_freshness_receipt' = p_freshness
      AND pattern_packet = p_pattern;
  IF NOT FOUND THEN RAISE EXCEPTION 'evidence repair decision lost packet version race'; END IF;

  INSERT INTO public.evidence_repair_human_qa_receipts (
    case_id, packet_id, packet_version, original_packet_id, original_packet_version,
    calendar_item_id, social_content_id, content_version, decision, reason, reviewer_id, surface,
    source_sha256, source_expires_at, approved_copy_sha256, claim_boundary_sha256,
    candidate_snapshot, freshness_snapshot, slack_identity, idempotency_key
  ) VALUES (
    v_case_id, p_packet_id, p_packet_version, v_original_id,
    (p_candidate->>'original_packet_version')::timestamptz,
    v_calendar_id, v_social_id, p_content_version, p_decision, btrim(p_reason), p_reviewer_id,
    p_surface, v_source_hash, (p_freshness->>'expires_at')::timestamptz,
    v_copy_hash, p_claim_boundary_sha256, p_candidate, p_freshness, p_slack_identity, p_idempotency_key
  ) RETURNING * INTO v_receipt;
  RETURN to_jsonb(v_receipt) || jsonb_build_object('replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.record_evidence_repair_human_qa_decision(
  uuid,timestamptz,jsonb,jsonb,jsonb,text,timestamptz,text,text,uuid,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_evidence_repair_human_qa_decision(
  uuid,timestamptz,jsonb,jsonb,jsonb,text,timestamptz,text,text,uuid,text,text,jsonb)
  TO service_role;
COMMIT;

-- Rollback (only before any real receipt exists):
-- DROP FUNCTION public.record_evidence_repair_human_qa_decision(uuid,timestamptz,jsonb,jsonb,jsonb,text,timestamptz,text,text,uuid,text,text,jsonb);
-- DROP TABLE public.evidence_repair_human_qa_receipts;
-- DROP FUNCTION public.reject_evidence_repair_receipt_mutation();
-- Once receipts exist, retain them and disable callers instead of deleting audit history.
