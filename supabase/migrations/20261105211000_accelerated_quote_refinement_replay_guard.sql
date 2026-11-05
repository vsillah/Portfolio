-- Validate the authenticated account email before an idempotent contact replay.
CREATE OR REPLACE FUNCTION public.accelerated_submit_contextual_quote(
  p_user_id uuid,p_order_id bigint,p_refinement_id uuid,p_email text
) RETURNS TABLE(contact_id bigint,replay boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE; v_ref public.accelerated_quote_refinements%ROWTYPE;
  v_existing public.accelerated_quote_contact_links%ROWTYPE; v_intake public.accelerated_decision_file_intakes%ROWTYPE;
  v_email text; v_contact_id bigint;
BEGIN
  SELECT lower(email) INTO v_email FROM public.user_profiles WHERE id=p_user_id;
  IF v_email IS NULL OR v_email IS DISTINCT FROM lower(btrim(coalesce(p_email,''))) THEN
    RAISE EXCEPTION 'Quote contact must use the member account email' USING ERRCODE='P0001'; END IF;
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
