-- Synthetic staging smoke. Every fixture and order is rolled back.
BEGIN;
SET LOCAL statement_timeout = '45s';

INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES
  ('c0000000-0000-4000-8000-000000000001','qa-accelerated-a@example.invalid','{}'),
  ('c0000000-0000-4000-8000-000000000002','qa-accelerated-b@example.invalid','{}');

INSERT INTO public.diagnostic_audits (id,user_id,audit_type,status,metadata)
VALUES (920000000001,'c0000000-0000-4000-8000-000000000001','chat','completed','{}');

INSERT INTO public.accelerated_decision_file_intakes
  (id,worksheet_id,content_version,payload_sha256,learner_name,learner_email,answers,
   consented_at,review_status,linked_audit_id,reviewed_by,reviewed_at)
VALUES
  ('c0000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000007',
   'qa-accelerated-commerce',repeat('a',64),'Synthetic QA','qa-accelerated-a@example.invalid','{}',
   now(),'linked',920000000001,'c0000000-0000-4000-8000-000000000001',now());

INSERT INTO public.accelerated_decision_file_owners (intake_id,user_id,verified_by)
VALUES ('c0000000-0000-4000-8000-000000000005',
  'c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001');

INSERT INTO public.services (id,title,service_type,delivery_method,price,is_quote_based,is_active)
VALUES
 ('c0000000-0000-4000-8000-000000000003','Synthetic fixed session','consulting','virtual',240,false,true),
 ('c0000000-0000-4000-8000-000000000004','Synthetic custom scope','consulting','virtual',NULL,true,true);

INSERT INTO public.products (id,title,type,price,is_active,is_print_on_demand)
VALUES
 (920000000002,'Synthetic digital guide','ebook',50,true,false),
 (920000000003,'Synthetic merchandise','merchandise',35,true,true);

INSERT INTO public.product_variants
  (id,product_id,printful_variant_id,color,price,is_available,updated_at)
VALUES (920000000004,920000000003,920000000005,'Synthetic blue',45,true,now());

SET LOCAL ROLE service_role;
DO $smoke$
DECLARE
  v_member constant uuid := 'c0000000-0000-4000-8000-000000000001';
  v_other constant uuid := 'c0000000-0000-4000-8000-000000000002';
  v_intake constant uuid := 'c0000000-0000-4000-8000-000000000005';
  v_fixed_service constant uuid := 'c0000000-0000-4000-8000-000000000003';
  v_quote_service constant uuid := 'c0000000-0000-4000-8000-000000000004';
  v_key constant uuid := 'c0000000-0000-4000-8000-000000000006';
  v_fixed uuid;
  v_quote uuid;
  v_merch uuid;
  v_fixed_reviewed timestamptz;
  v_quote_reviewed timestamptz;
  v_merch_reviewed timestamptz;
  v_selected record;
  v_checkout record;
  v_replay record;
  v_quote_order record;
  v_quote_replay record;
  v_quote_contact record;
  v_refinement record;
  v_package jsonb;
  v_order record;
  v_items jsonb;
  v_count integer;
  v_rejected boolean;
  v_legacy_id bigint;
BEGIN
  SELECT public.accelerated_approve_member_recommendation(
    v_intake,920000000001,'service',v_fixed_service::text,
    'Synthetic fixed session','Synthetic reviewed next step',v_member) INTO v_fixed;
  SELECT public.accelerated_approve_member_recommendation(
    v_intake,920000000001,'service',v_quote_service::text,
    'Synthetic custom scope','Synthetic reviewed quote',v_member) INTO v_quote;
  SELECT public.accelerated_approve_member_recommendation(
    v_intake,920000000001,'product','920000000003',
    'Synthetic merchandise','Synthetic reviewed variant',v_member) INTO v_merch;

  SELECT reviewed_at INTO v_fixed_reviewed FROM public.accelerated_member_recommendations WHERE id=v_fixed;
  SELECT reviewed_at INTO v_quote_reviewed FROM public.accelerated_member_recommendations WHERE id=v_quote;
  SELECT reviewed_at INTO v_merch_reviewed FROM public.accelerated_member_recommendations WHERE id=v_merch;

  SELECT * INTO v_selected FROM public.accelerated_select_member_recommendation(
    v_member,v_fixed,v_fixed_reviewed,NULL);
  IF v_selected.quote_based OR v_selected.unit_price IS DISTINCT FROM 240::numeric THEN
    RAISE EXCEPTION 'fixed offer price mismatch' USING ERRCODE='XX000';
  END IF;
  SELECT * INTO v_selected FROM public.accelerated_select_member_recommendation(
    v_member,v_quote,v_quote_reviewed,NULL);
  IF NOT v_selected.quote_based OR v_selected.unit_price IS NOT NULL THEN
    RAISE EXCEPTION 'quote branch mismatch' USING ERRCODE='XX000';
  END IF;
  SELECT count(*) INTO v_count FROM public.cart_items WHERE accelerated_recommendation_id=v_quote;
  IF v_count <> 0 THEN RAISE EXCEPTION 'quote selection created a cart row' USING ERRCODE='XX000'; END IF;
  SELECT * INTO v_quote_order FROM public.accelerated_create_member_quote_order(
    v_member,v_quote,v_quote_reviewed);
  IF v_quote_order.replay THEN RAISE EXCEPTION 'first quote order marked replay' USING ERRCODE='XX000'; END IF;
  SELECT * INTO v_quote_replay FROM public.accelerated_create_member_quote_order(
    v_member,v_quote,v_quote_reviewed);
  IF NOT v_quote_replay.replay OR v_quote_replay.order_id <> v_quote_order.order_id THEN
    RAISE EXCEPTION 'quote order replay mismatch' USING ERRCODE='XX000';
  END IF;
  SELECT count(*) INTO v_count FROM public.orders o JOIN public.order_items oi ON oi.order_id=o.id
    WHERE o.id=v_quote_order.order_id AND o.user_id=v_member AND o.status='quote_pending'
      AND o.total_amount=0 AND o.final_amount=0 AND o.stripe_payment_intent_id IS NULL
      AND o.accelerated_quote_recommendation_id=v_quote
      AND o.accelerated_quote_reviewed_at=v_quote_reviewed
      AND oi.service_id=v_quote_service AND oi.accelerated_recommendation_id=v_quote
      AND oi.accelerated_reviewed_at=v_quote_reviewed;
  IF v_count <> 1 THEN RAISE EXCEPTION 'quote order lineage mismatch' USING ERRCODE='XX000'; END IF;
  v_package := jsonb_build_object('intakeId',v_intake::text,
    'intakePayloadSha256',repeat('a',64),'worksheetId','c0000000-0000-4000-8000-000000000007',
    'worksheetSha256',repeat('a',64),'catalogSha256',repeat('c',64),
    'recommendationId',v_quote::text,'reviewedAt',v_quote_reviewed,
    'questionSetVersion','accelerated-quote-questions-v1','rulesVersion','accelerated-quote-rules-v1',
    'answers','{}'::jsonb,'projection',jsonb_build_object('status','candidates',
      'remaining',jsonb_build_array(jsonb_build_object('kind','service','id',v_quote_service::text))));
  SELECT * INTO v_refinement FROM public.accelerated_save_quote_refinement(
    v_member,v_quote_order.order_id,0,v_key,repeat('b',64),v_package);
  IF v_refinement.replay OR v_refinement.revision <> 1 THEN
    RAISE EXCEPTION 'refinement receipt mismatch' USING ERRCODE='XX000'; END IF;
  SELECT * INTO v_quote_replay FROM public.accelerated_save_quote_refinement(
    v_member,v_quote_order.order_id,0,v_key,repeat('b',64),v_package);
  IF NOT v_quote_replay.replay OR v_quote_replay.refinement_id <> v_refinement.refinement_id THEN
    RAISE EXCEPTION 'refinement replay mismatch' USING ERRCODE='XX000'; END IF;
  SELECT * INTO v_quote_contact FROM public.accelerated_submit_contextual_quote(
    v_member,v_quote_order.order_id,v_refinement.refinement_id,'qa-accelerated-a@example.invalid');
  IF v_quote_contact.replay OR v_quote_contact.contact_id IS NULL THEN
    RAISE EXCEPTION 'quote contact was not created' USING ERRCODE='XX000';
  END IF;
  SELECT * INTO v_quote_replay FROM public.accelerated_submit_contextual_quote(
    v_member,v_quote_order.order_id,v_refinement.refinement_id,'qa-accelerated-a@example.invalid');
  IF NOT v_quote_replay.replay OR v_quote_replay.contact_id <> v_quote_contact.contact_id THEN
    RAISE EXCEPTION 'quote contact replay mismatch' USING ERRCODE='XX000';
  END IF;
  SELECT count(*) INTO v_count FROM public.accelerated_quote_contact_links l
    JOIN public.contact_submissions c ON c.id=l.contact_submission_id
    WHERE l.order_id=v_quote_order.order_id AND l.user_id=v_member
      AND l.recommendation_id=v_quote AND l.reviewed_at=v_quote_reviewed
      AND c.email='qa-accelerated-a@example.invalid' AND l.refinement_id=v_refinement.refinement_id
      AND l.context_package=v_package;
  IF v_count <> 1 THEN RAISE EXCEPTION 'quote contact binding mismatch' USING ERRCODE='XX000'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_save_quote_refinement(v_member,v_quote_order.order_id,1,
      'c0000000-0000-4000-8000-000000000008',repeat('d',64),v_package);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'submitted quote accepted another refinement' USING ERRCODE='XX000'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_create_member_quote_order(v_other,v_quote,v_quote_reviewed);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'wrong-user quote order accepted' USING ERRCODE='XX000'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_create_member_quote_order(v_member,v_quote,
      v_quote_reviewed - interval '1 second');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'stale quote review accepted' USING ERRCODE='XX000'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_submit_contextual_quote(v_other,v_quote_order.order_id,
      v_refinement.refinement_id,'qa-accelerated-b@example.invalid');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'wrong-user quote contact accepted' USING ERRCODE='XX000'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_submit_contextual_quote(v_member,v_quote_order.order_id,
      v_refinement.refinement_id,'wrong@example.invalid');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'tampered quote email accepted' USING ERRCODE='XX000'; END IF;
  v_rejected := false;
  BEGIN
    UPDATE public.order_items SET accelerated_reviewed_at=v_quote_reviewed - interval '1 second'
      WHERE order_id=v_quote_order.order_id;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'quote lineage mutation accepted' USING ERRCODE='XX000'; END IF;

  SELECT * INTO v_selected FROM public.accelerated_select_member_recommendation(
    v_member,v_merch,v_merch_reviewed,920000000004);
  IF v_selected.quote_based OR v_selected.unit_price IS DISTINCT FROM 45::numeric THEN
    RAISE EXCEPTION 'variant price mismatch' USING ERRCODE='XX000';
  END IF;

  v_items := jsonb_build_array(
    jsonb_build_object('itemType','service','serviceId',v_fixed_service::text,'quantity',1,
      'recommendationId',v_fixed::text,'reviewedAt',v_fixed_reviewed::text,'reviewedPrice',0.01),
    jsonb_build_object('itemType','product','productId',920000000003,'variantId',920000000004,
      'quantity',1,'recommendationId',v_merch::text,'reviewedAt',v_merch_reviewed::text,'reviewedPrice',0.01),
    jsonb_build_object('itemType','product','productId',920000000002,'quantity',2,'price',0.01)
  );
  SELECT * INTO v_checkout FROM public.accelerated_checkout_member_cart(
    v_member,v_key,v_items,'{"address1":"1 Synthetic Way","zip":"00000"}'::jsonb,7.99);
  IF v_checkout.replay THEN RAISE EXCEPTION 'first checkout marked replay' USING ERRCODE='XX000'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=v_checkout.order_id;
  IF v_order.user_id IS DISTINCT FROM v_member
    OR v_order.total_amount IS DISTINCT FROM 385::numeric
    OR v_order.final_amount IS DISTINCT FROM 392.99::numeric
    OR v_order.status IS DISTINCT FROM 'pending'
    OR cardinality(v_order.accelerated_recommendation_ids) <> 2 THEN
    RAISE EXCEPTION 'server-priced order mismatch' USING ERRCODE='XX000';
  END IF;
  SELECT count(*) INTO v_count FROM public.order_items WHERE order_id=v_checkout.order_id;
  IF v_count <> 3 THEN RAISE EXCEPTION 'expected three order lines' USING ERRCODE='XX000'; END IF;
  SELECT count(*) INTO v_count FROM public.order_items WHERE order_id=v_checkout.order_id
    AND ((accelerated_recommendation_id=v_fixed AND price_at_purchase=240)
      OR (accelerated_recommendation_id=v_merch AND price_at_purchase=45)
      OR (accelerated_recommendation_id IS NULL AND price_at_purchase=50 AND quantity=2));
  IF v_count <> 3 THEN RAISE EXCEPTION 'order line price or lineage mismatch' USING ERRCODE='XX000'; END IF;

  SELECT * INTO v_replay FROM public.accelerated_checkout_member_cart(
    v_member,v_key,v_items,'{"address1":"1 Synthetic Way","zip":"00000"}'::jsonb,7.99);
  IF NOT v_replay.replay OR v_replay.order_id <> v_checkout.order_id THEN
    RAISE EXCEPTION 'idempotent replay mismatch' USING ERRCODE='XX000';
  END IF;
  SELECT count(*) INTO v_count FROM public.orders WHERE accelerated_checkout_key=v_key;
  IF v_count <> 1 THEN RAISE EXCEPTION 'duplicate checkout order' USING ERRCODE='XX000'; END IF;
  SELECT count(*) INTO v_count FROM public.verified_client_project_memberships WHERE user_id=v_member;
  IF v_count <> 0 THEN RAISE EXCEPTION 'purchase created client membership' USING ERRCODE='XX000'; END IF;

  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_select_member_recommendation(v_other,v_fixed,v_fixed_reviewed,NULL);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'wrong-user selection accepted' USING ERRCODE='XX000'; END IF;

  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_select_member_recommendation(v_member,v_fixed,
      v_fixed_reviewed - interval '1 second',NULL);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'stale review accepted' USING ERRCODE='XX000'; END IF;

  UPDATE public.services SET price=10 WHERE id=v_quote_service;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_create_member_quote_order(v_member,v_quote,v_quote_reviewed);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'changed quote catalog accepted' USING ERRCODE='XX000'; END IF;

  UPDATE public.accelerated_member_recommendations SET review_status='rejected' WHERE id=v_quote;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_select_member_recommendation(v_member,v_quote,v_quote_reviewed,NULL);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'rejected quote accepted' USING ERRCODE='XX000'; END IF;

  UPDATE public.services SET price=241 WHERE id=v_fixed_service;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_select_member_recommendation(v_member,v_fixed,v_fixed_reviewed,NULL);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'stale price accepted' USING ERRCODE='XX000'; END IF;

  UPDATE public.product_variants SET price=46 WHERE id=920000000004;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_select_member_recommendation(v_member,v_merch,
      v_merch_reviewed,920000000004);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'stale variant accepted' USING ERRCODE='XX000'; END IF;

  INSERT INTO public.orders(user_id,total_amount,final_amount,status)
    VALUES(v_member,50,50,'pending') RETURNING id INTO v_legacy_id;
  INSERT INTO public.order_items(order_id,product_id,quantity,price_at_purchase)
    VALUES(v_legacy_id,920000000002,1,50);
  v_rejected := false;
  BEGIN
    UPDATE public.order_items SET order_id=v_quote_order.order_id
      WHERE order_id=v_legacy_id;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'legacy line moved into quote order' USING ERRCODE='XX000'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE id=v_legacy_id AND accelerated_checkout_key IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.order_items WHERE order_id=v_legacy_id
      AND accelerated_recommendation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'legacy store row gained lineage' USING ERRCODE='XX000';
  END IF;
END
$smoke$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
DO $rls$
DECLARE v_count integer; v_quote uuid; v_reviewed timestamptz; v_rejected boolean := false;
BEGIN
  SELECT count(*) INTO v_count FROM public.orders
    WHERE accelerated_checkout_key='c0000000-0000-4000-8000-000000000006'::uuid
       OR accelerated_quote_recommendation_id IS NOT NULL;
  IF v_count <> 2 THEN RAISE EXCEPTION 'member cannot see own orders' USING ERRCODE='XX000'; END IF;
  SELECT id,reviewed_at INTO v_quote,v_reviewed FROM public.accelerated_member_recommendations
    WHERE offer_id='c0000000-0000-4000-8000-000000000003';
  IF v_quote IS NULL THEN RAISE EXCEPTION 'member cannot see own approved recommendation' USING ERRCODE='XX000'; END IF;
  BEGIN
    PERFORM public.accelerated_select_member_recommendation(
      'c0000000-0000-4000-8000-000000000001'::uuid,v_quote,v_reviewed,NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'authenticated role executed service RPC' USING ERRCODE='XX000'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_create_member_quote_order(
      'c0000000-0000-4000-8000-000000000001'::uuid,v_quote,v_reviewed);
  EXCEPTION WHEN insufficient_privilege THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'authenticated role created quote order' USING ERRCODE='XX000'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.accelerated_submit_member_quote(
      'c0000000-0000-4000-8000-000000000001'::uuid,1203,'Synthetic QA',
      'qa-accelerated-a@example.invalid','Tampered direct call');
  EXCEPTION WHEN insufficient_privilege THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'authenticated role submitted quote' USING ERRCODE='XX000'; END IF;
  v_rejected := false;
  BEGIN
    INSERT INTO public.cart_items(user_id,service_id,quantity,
      accelerated_recommendation_id,accelerated_reviewed_at)
    VALUES ('c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000004',1,
      (SELECT id FROM public.accelerated_member_recommendations
        WHERE offer_id='c0000000-0000-4000-8000-000000000004'),
      v_reviewed);
  EXCEPTION WHEN insufficient_privilege THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'direct cart lineage insert accepted' USING ERRCODE='XX000'; END IF;
END
$rls$;
SELECT set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000002',true);
DO $isolation$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.orders
    WHERE accelerated_checkout_key='c0000000-0000-4000-8000-000000000006'::uuid
       OR accelerated_quote_recommendation_id IS NOT NULL;
  IF v_count <> 0 THEN RAISE EXCEPTION 'other member can see orders' USING ERRCODE='XX000'; END IF;
  SELECT count(*) INTO v_count FROM public.accelerated_member_recommendations
    WHERE offer_id='c0000000-0000-4000-8000-000000000003';
  IF v_count <> 0 THEN RAISE EXCEPTION 'other member can see recommendation' USING ERRCODE='XX000'; END IF;
END
$isolation$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: synthetic commerce transaction rolled back' AS result;
