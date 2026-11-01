-- Record the six reviewed Dark Castle prerequisites as one immutable transaction.
CREATE TABLE public.dark_castle_prerequisite_receipts (
  receipt_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL UNIQUE CHECK (kind IN ('source','voice','framework','privacy','visual','challenger')),
  packet_id TEXT NOT NULL UNIQUE,
  evidence_fingerprint TEXT NOT NULL,
  social_content_id UUID NOT NULL REFERENCES public.social_content_queue(id),
  content_version TEXT NOT NULL,
  source_content_updated_at TIMESTAMPTZ NOT NULL,
  projected_content_updated_at TIMESTAMPTZ NOT NULL,
  reviewer_id UUID NOT NULL,
  artifact_hashes JSONB NOT NULL,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dark_castle_prerequisite_receipts ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.reject_dark_castle_receipt_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Dark Castle prerequisite receipts are immutable';
END; $$;
CREATE TRIGGER dark_castle_receipts_immutable BEFORE UPDATE OR DELETE
ON public.dark_castle_prerequisite_receipts FOR EACH ROW
EXECUTE FUNCTION public.reject_dark_castle_receipt_change();

REVOKE ALL ON public.dark_castle_prerequisite_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.dark_castle_prerequisite_receipts TO service_role;

CREATE FUNCTION public.record_dark_castle_prerequisite_receipts(
  p_social_content_id UUID,
  p_source_content_updated_at TIMESTAMPTZ,
  p_reviewer_id UUID,
  p_receipts JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_item public.social_content_queue%ROWTYPE;
  v_kind TEXT;
  v_packet_id TEXT;
  v_fingerprint TEXT;
  v_receipt_id TEXT;
  v_input JSONB;
  v_hashes JSONB := jsonb_build_object(
    'script_sha256','982e17676e9125f201506cb59e38f3b813828bfe13681292bf5c23ba48ef83e0',
    'storyboard_sha256','9294ec46df24122577de4b4253f30709f50abb546ad3412be5e74bee75f82043',
    'master_sha256','2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36',
    'thumbnail_sha256','5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0',
    'description_sha256','224f7d07a4d55a9de3d22028ce81a76312fe64e52f06bcf38c440da89a90817d');
  v_bundle JSONB := '{}'::jsonb;
  v_projected_at TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  IF p_reviewer_id IS NULL THEN RAISE EXCEPTION 'Reviewer identity required'; END IF;
  IF p_social_content_id IS DISTINCT FROM 'c12378f2-36de-4bf7-8c5d-0ce754e727eb'::uuid
     OR p_source_content_updated_at IS DISTINCT FROM '2026-10-27T20:14:59.293829Z'::timestamptz THEN
    RAISE EXCEPTION 'Wrong record or source timestamp';
  END IF;
  IF jsonb_typeof(p_receipts) IS DISTINCT FROM 'array' OR jsonb_array_length(p_receipts) <> 6 THEN
    RAISE EXCEPTION 'Exactly six prerequisite receipts required';
  END IF;
  SELECT * INTO v_item FROM public.social_content_queue WHERE id = p_social_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Canonical record missing'; END IF;
  IF v_item.platform IS DISTINCT FROM 'youtube' OR v_item.status IS DISTINCT FROM 'draft'
     OR v_item.rag_context ->> 'content_version' IS DISTINCT FROM 'sha256:4b4126fe2388687c899530cdb9ee973e744d9e0ebfd2b6378ac6b3702000342a'
     OR v_item.rag_context -> 'youtube_description_receipt' ->> 'description_sha256' IS DISTINCT FROM v_hashes ->> 'description_sha256'
     OR v_item.rag_context -> 'youtube_description_receipt' ->> 'receipt_id' IS DISTINCT FROM 'youtube-description:dark-castle:sha256:224f7d07a4d55a9d'
     OR v_item.rag_context -> 'youtube_description_receipt' ->> 'social_content_id' IS DISTINCT FROM p_social_content_id::text
     OR v_item.rag_context -> 'youtube_description_receipt' ->> 'content_version' IS DISTINCT FROM v_item.rag_context ->> 'content_version'
     OR v_item.rag_context -> 'youtube_description_receipt' ->> 'human_qa_status' IS DISTINCT FROM 'pending'
     OR v_item.rag_context -> 'description_evidence_reconciliation_receipt' ->> 'status' IS DISTINCT FROM 'passed'
     OR v_item.rag_context -> 'description_evidence_reconciliation_receipt' ->> 'receipt_id' IS DISTINCT FROM 'youtube-description-evidence-reconciliation:fnv1a:07f944bb'
     OR v_item.rag_context -> 'description_evidence_reconciliation_receipt' ->> 'social_content_id' IS DISTINCT FROM p_social_content_id::text
     OR v_item.rag_context -> 'description_evidence_reconciliation_receipt' ->> 'content_version' IS DISTINCT FROM v_item.rag_context ->> 'content_version'
     OR v_item.rag_context -> 'description_evidence_reconciliation_receipt' ->> 'evidence_input_fingerprint'
        IS DISTINCT FROM v_item.rag_context -> 'youtube_description_receipt' ->> 'evidence_input_fingerprint'
     OR encode(sha256(convert_to(v_item.youtube_description, 'UTF8')), 'hex') IS DISTINCT FROM v_hashes ->> 'description_sha256'
     OR v_item.rag_context ? 'mobile_decision_review' THEN
    RAISE EXCEPTION 'Canonical record, description, or evidence is stale or mismatched';
  END IF;

  SELECT count(*) INTO v_count FROM public.dark_castle_prerequisite_receipts WHERE social_content_id = p_social_content_id;
  IF v_count > 0 THEN
    IF v_count <> 6 OR v_item.rag_context -> 'copy_review_evidence_receipts' IS NULL THEN
      RAISE EXCEPTION 'Partial receipt lineage or projection';
    END IF;
    v_projected_at := v_item.updated_at;
  ELSE
    IF v_item.updated_at IS DISTINCT FROM p_source_content_updated_at
       OR v_item.rag_context ? 'copy_review_evidence_receipts' THEN
      RAISE EXCEPTION 'Source content timestamp is stale or projection already exists';
    END IF;
    -- The queue update trigger controls the version. Use its returned timestamp
    -- for the canonical receipts expected by the subsequent copy-review step.
    UPDATE public.social_content_queue SET updated_at = now() WHERE id = p_social_content_id
    RETURNING updated_at INTO v_projected_at;
    IF v_projected_at <= p_source_content_updated_at THEN
      RAISE EXCEPTION 'Projected content timestamp did not advance';
    END IF;
  END IF;

  FOR v_kind, v_packet_id, v_fingerprint IN
    SELECT * FROM (VALUES
      ('source','dark-castle-review-packet:source:b7384cb6b3ce6a08ce5f','b7384cb6b3ce6a08ce5f'),
      ('voice','dark-castle-review-packet:voice:d71bc6374af17869a07f','d71bc6374af17869a07f'),
      ('framework','dark-castle-review-packet:framework:dc30eae3d2e4d2f0ee91','dc30eae3d2e4d2f0ee91'),
      ('privacy','dark-castle-review-packet:privacy:00638b5286ff8faf8263','00638b5286ff8faf8263'),
      ('visual','dark-castle-review-packet:visual:cb1ccd18ba7c66e3d4a7','cb1ccd18ba7c66e3d4a7'),
      ('challenger','dark-castle-review-packet:challenger:32b51b3bf5fb5b062950','32b51b3bf5fb5b062950')
    ) expected(kind, packet_id, fingerprint)
  LOOP
    SELECT value INTO v_input FROM jsonb_array_elements(p_receipts) value WHERE value ->> 'kind' = v_kind;
    IF v_input IS NULL OR (SELECT count(*) FROM jsonb_array_elements(p_receipts) value WHERE value ->> 'kind' = v_kind) <> 1
       OR v_input ->> 'packet_id' IS DISTINCT FROM v_packet_id
       OR v_input ->> 'evidence_fingerprint' IS DISTINCT FROM v_fingerprint
       OR v_input ->> 'receipt_id' IS DISTINCT FROM (v_packet_id || ':approved')
       OR v_input ->> 'status' IS DISTINCT FROM 'approved'
       OR v_input ->> 'reviewer_id' IS DISTINCT FROM p_reviewer_id::text
       OR v_input ->> 'source_content_updated_at' IS DISTINCT FROM '2026-10-27T20:14:59.293829Z'
       OR v_input -> 'artifact_hashes' IS DISTINCT FROM v_hashes
       OR (v_kind = 'visual' AND (v_input ->> 'asset_sha256' IS DISTINCT FROM ('sha256:' || (v_hashes ->> 'thumbnail_sha256'))
         OR v_input ->> 'asset_path' IS DISTINCT FROM '/review-assets/social-content/dark-castle-youtube-master-2026-10-29/03-accidental-success-v2.png')) THEN
      RAISE EXCEPTION 'Missing, duplicated, or mismatched % receipt', v_kind;
    END IF;
    v_receipt_id := v_input ->> 'receipt_id';
    v_input := v_input || jsonb_build_object('content_updated_at', v_projected_at,
      'content_version', v_item.rag_context ->> 'content_version', 'social_content_id', p_social_content_id,
      'external_execution', false);
    v_bundle := v_bundle || jsonb_build_object(v_kind, v_input);
    IF v_count = 0 THEN
      INSERT INTO public.dark_castle_prerequisite_receipts
        (receipt_id,kind,packet_id,evidence_fingerprint,social_content_id,content_version,
         source_content_updated_at,projected_content_updated_at,reviewer_id,artifact_hashes,receipt)
      VALUES (v_receipt_id,v_kind,v_packet_id,v_fingerprint,p_social_content_id,
        v_item.rag_context ->> 'content_version',p_source_content_updated_at,v_projected_at,p_reviewer_id,v_hashes,v_input);
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.dark_castle_prerequisite_receipts r
        WHERE r.kind = v_kind AND r.receipt_id = v_receipt_id AND r.packet_id = v_packet_id
          AND r.evidence_fingerprint = v_fingerprint AND r.reviewer_id = p_reviewer_id
          AND r.source_content_updated_at = p_source_content_updated_at
          AND r.projected_content_updated_at = v_projected_at AND r.artifact_hashes = v_hashes
          AND r.receipt = v_input) THEN
        RAISE EXCEPTION 'Immutable % receipt replay mismatch', v_kind;
      END IF;
    END IF;
  END LOOP;
  IF v_count = 0 THEN
    UPDATE public.social_content_queue
      SET rag_context = rag_context || jsonb_build_object('copy_review_evidence_receipts', v_bundle),
          updated_at = v_projected_at
      WHERE id = p_social_content_id RETURNING * INTO v_item;
    IF v_item.updated_at IS DISTINCT FROM v_projected_at THEN
      RAISE EXCEPTION 'Receipt projection timestamp changed';
    END IF;
  ELSIF v_item.rag_context -> 'copy_review_evidence_receipts' IS DISTINCT FROM v_bundle THEN
    RAISE EXCEPTION 'Immutable receipt projection mismatch';
  END IF;
  RETURN jsonb_build_object('recorded', true, 'receipt_ids', (SELECT jsonb_agg(receipt_id ORDER BY kind)
    FROM public.dark_castle_prerequisite_receipts WHERE social_content_id = p_social_content_id),
    'source_content_updated_at', p_source_content_updated_at, 'content_updated_at', v_projected_at,
    'idempotent_replay', v_count = 6, 'external_execution', false);
END; $$;

REVOKE ALL ON FUNCTION public.record_dark_castle_prerequisite_receipts(UUID,TIMESTAMPTZ,UUID,JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_dark_castle_prerequisite_receipts(UUID,TIMESTAMPTZ,UUID,JSONB)
  TO service_role;
