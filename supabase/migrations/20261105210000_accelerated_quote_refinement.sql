-- Append-only, member-owned refinement receipts. Raw Decision File answers stay in the intake.
CREATE TABLE public.accelerated_quote_refinements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id bigint NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  idempotency_key uuid NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  intake_id uuid NOT NULL REFERENCES public.accelerated_decision_file_intakes(id) ON DELETE RESTRICT,
  worksheet_id uuid NOT NULL,
  worksheet_sha256 text NOT NULL CHECK (worksheet_sha256 ~ '^[0-9a-f]{64}$'),
  catalog_sha256 text NOT NULL CHECK (catalog_sha256 ~ '^[0-9a-f]{64}$'),
  question_set_version text NOT NULL,
  rules_version text NOT NULL,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  context_package jsonb NOT NULL CHECK (jsonb_typeof(context_package) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,revision), UNIQUE(order_id,idempotency_key)
);
ALTER TABLE public.accelerated_quote_refinements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accelerated_quote_refinements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.accelerated_quote_refinements TO service_role;

ALTER TABLE public.accelerated_quote_contact_links
  ADD COLUMN refinement_id uuid UNIQUE REFERENCES public.accelerated_quote_refinements(id) ON DELETE RESTRICT,
  ADD COLUMN context_package jsonb;

CREATE FUNCTION public.accelerated_save_quote_refinement(
  p_user_id uuid, p_order_id bigint, p_expected_revision integer, p_idempotency_key uuid,
  p_payload_sha256 text, p_context_package jsonb
) RETURNS TABLE(refinement_id uuid, revision integer, replay boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_order public.orders%ROWTYPE; v_rec record; v_intake record;
  v_latest public.accelerated_quote_refinements%ROWTYPE;
  v_same public.accelerated_quote_refinements%ROWTYPE; v_next integer; v_new_id uuid;
BEGIN
  IF p_expected_revision < 0 OR p_context_package IS NULL OR
    p_payload_sha256 !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_context_package) <> 'object' OR
    octet_length(p_context_package::text) > 60000 THEN
    RAISE EXCEPTION 'Invalid refinement receipt' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND user_id=p_user_id
    AND status='quote_pending' AND accelerated_quote_recommendation_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote order is unavailable for this member' USING ERRCODE='P0001'; END IF;
  SELECT r.intake_id,r.audit_id,r.reviewed_at,r.review_status INTO v_rec
    FROM public.accelerated_member_recommendations r
    WHERE r.id=v_order.accelerated_quote_recommendation_id AND r.user_id=p_user_id;
  IF v_rec.review_status IS DISTINCT FROM 'approved' OR v_rec.reviewed_at IS DISTINCT FROM v_order.accelerated_quote_reviewed_at THEN
    RAISE EXCEPTION 'Reviewed recommendation changed' USING ERRCODE='P0001';
  END IF;
  PERFORM 1 FROM public.accelerated_validate_member_offer(p_user_id,v_order.accelerated_quote_recommendation_id,
    v_order.accelerated_quote_reviewed_at,NULL);
  SELECT i.id,i.worksheet_id,i.payload_sha256,i.linked_audit_id,i.review_status INTO v_intake
    FROM public.accelerated_decision_file_intakes i
    JOIN public.accelerated_decision_file_owners o ON o.intake_id=i.id AND o.user_id=p_user_id
    JOIN public.diagnostic_audits a ON a.id=i.linked_audit_id AND a.user_id=p_user_id AND a.status='completed'
    WHERE i.id=v_rec.intake_id;
  IF NOT FOUND OR v_intake.review_status <> 'linked' OR v_intake.linked_audit_id <> v_rec.audit_id OR
    p_context_package->>'intakeId' IS DISTINCT FROM v_intake.id::text OR
    p_context_package->>'intakePayloadSha256' IS DISTINCT FROM v_intake.payload_sha256 OR
    p_context_package->>'worksheetId' IS DISTINCT FROM v_intake.worksheet_id::text OR
    p_context_package->>'recommendationId' IS DISTINCT FROM v_order.accelerated_quote_recommendation_id::text OR
    (p_context_package->>'reviewedAt')::timestamptz IS DISTINCT FROM v_order.accelerated_quote_reviewed_at THEN
    RAISE EXCEPTION 'Decision File and quote lineage do not match' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_same FROM public.accelerated_quote_refinements
    WHERE order_id=p_order_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_same.payload_sha256 <> p_payload_sha256 THEN RAISE EXCEPTION 'Idempotency key was reused with different context' USING ERRCODE='P0001'; END IF;
    RETURN QUERY SELECT v_same.id,v_same.revision,true; RETURN;
  END IF;
  SELECT * INTO v_latest FROM public.accelerated_quote_refinements WHERE order_id=p_order_id ORDER BY revision DESC LIMIT 1;
  IF coalesce(v_latest.revision,0) <> p_expected_revision THEN
    RAISE EXCEPTION 'Quote context changed. Reload before saving.' USING ERRCODE='P0001';
  END IF;
  IF v_latest.payload_sha256 = p_payload_sha256 THEN
    RETURN QUERY SELECT v_latest.id,v_latest.revision,true; RETURN;
  END IF;
  v_next := p_expected_revision + 1;
  INSERT INTO public.accelerated_quote_refinements(order_id,user_id,revision,idempotency_key,payload_sha256,
    intake_id,worksheet_id,worksheet_sha256,catalog_sha256,question_set_version,rules_version,answers,context_package)
  VALUES(p_order_id,p_user_id,v_next,p_idempotency_key,p_payload_sha256,v_intake.id,v_intake.worksheet_id,
    p_context_package->>'worksheetSha256',p_context_package->>'catalogSha256',
    p_context_package->>'questionSetVersion',p_context_package->>'rulesVersion',
    p_context_package->'answers',p_context_package)
  RETURNING id INTO v_new_id;
  RETURN QUERY SELECT v_new_id,v_next,false;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_save_quote_refinement(uuid,bigint,integer,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_save_quote_refinement(uuid,bigint,integer,uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.accelerated_submit_contextual_quote(
  p_user_id uuid,p_order_id bigint,p_refinement_id uuid,p_email text
) RETURNS TABLE(contact_id bigint,replay boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE; v_ref public.accelerated_quote_refinements%ROWTYPE;
  v_existing public.accelerated_quote_contact_links%ROWTYPE; v_intake public.accelerated_decision_file_intakes%ROWTYPE;
  v_email text; v_contact_id bigint;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND user_id=p_user_id
    AND status='quote_pending' AND accelerated_quote_recommendation_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote order is unavailable for this member' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_existing FROM public.accelerated_quote_contact_links WHERE order_id=p_order_id;
  IF FOUND THEN
    IF v_existing.refinement_id IS DISTINCT FROM p_refinement_id THEN
      RAISE EXCEPTION 'A different quote request was already submitted' USING ERRCODE='P0001'; END IF;
    RETURN QUERY SELECT v_existing.contact_submission_id,true; RETURN;
  END IF;
  SELECT * INTO v_ref FROM public.accelerated_quote_refinements WHERE id=p_refinement_id
    AND order_id=p_order_id AND user_id=p_user_id;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.accelerated_quote_refinements WHERE order_id=p_order_id AND revision>v_ref.revision) OR
    v_ref.context_package->'projection'->>'status' = 'no_match' THEN
    RAISE EXCEPTION 'Saved quote context is stale or has no match' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.accelerated_validate_member_offer(p_user_id,v_order.accelerated_quote_recommendation_id,
    v_order.accelerated_quote_reviewed_at,NULL);
  SELECT * INTO v_intake FROM public.accelerated_decision_file_intakes WHERE id=v_ref.intake_id
    AND review_status='linked';
  IF NOT FOUND OR v_intake.payload_sha256 <> v_ref.context_package->>'intakePayloadSha256' THEN
    RAISE EXCEPTION 'Decision File changed' USING ERRCODE='P0001'; END IF;
  SELECT lower(email) INTO v_email FROM public.user_profiles WHERE id=p_user_id;
  IF v_email IS NULL OR v_email IS DISTINCT FROM lower(btrim(coalesce(p_email,''))) THEN
    RAISE EXCEPTION 'Quote contact must use the member account email' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.contact_submissions(name,email,message,lead_source)
    VALUES(v_intake.learner_name,v_email,'Accelerated contextual quote request #'||p_order_id||
      '. Review the protected refinement package for candidate fit and Decision File lineage.','website_form')
    RETURNING id INTO v_contact_id;
  INSERT INTO public.accelerated_quote_contact_links(order_id,user_id,recommendation_id,reviewed_at,
    contact_submission_id,message,refinement_id,context_package)
    VALUES(p_order_id,p_user_id,v_order.accelerated_quote_recommendation_id,v_order.accelerated_quote_reviewed_at,
      v_contact_id,'Contextual quote package attached',p_refinement_id,v_ref.context_package);
  RETURN QUERY SELECT v_contact_id,false;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_submit_contextual_quote(uuid,bigint,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_submit_contextual_quote(uuid,bigint,uuid,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.accelerated_submit_member_quote(uuid,bigint,text,text,text) FROM service_role;
