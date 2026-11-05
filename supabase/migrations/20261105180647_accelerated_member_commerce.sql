-- The existing checkout and dashboard already use these states. Staging had an older constraint.
ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'completed', 'quote_pending', 'failed', 'cancelled', 'refunded'));

-- An approval binds the exact catalog revision and price. Earlier approvals need operator
-- re-review; they have no price snapshot and cannot silently become purchasable.
ALTER TABLE public.accelerated_member_recommendations
  ADD COLUMN approved_price numeric,
  ADD COLUMN approved_offer_updated_at timestamptz,
  ADD COLUMN approved_is_quote_based boolean,
  ADD COLUMN approved_is_print_on_demand boolean,
  ADD COLUMN approved_variant_prices jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT accelerated_approved_variant_prices_array
    CHECK (jsonb_typeof(approved_variant_prices) = 'array');

ALTER TABLE public.cart_items
  ADD COLUMN accelerated_recommendation_id uuid
    REFERENCES public.accelerated_member_recommendations(id) ON DELETE RESTRICT,
  ADD COLUMN accelerated_reviewed_at timestamptz,
  ADD COLUMN accelerated_variant_id bigint REFERENCES public.product_variants(id) ON DELETE RESTRICT;
ALTER TABLE public.cart_items ADD CONSTRAINT accelerated_cart_binding_complete CHECK
  ((accelerated_recommendation_id IS NULL) = (accelerated_reviewed_at IS NULL));
DROP INDEX public.idx_cart_items_user_product_unique;
DROP INDEX public.idx_cart_items_user_service_unique;
CREATE UNIQUE INDEX idx_cart_items_user_product_unique ON public.cart_items(user_id, product_id)
  WHERE user_id IS NOT NULL AND product_id IS NOT NULL AND accelerated_recommendation_id IS NULL;
CREATE UNIQUE INDEX idx_cart_items_user_service_unique ON public.cart_items(user_id, service_id)
  WHERE user_id IS NOT NULL AND service_id IS NOT NULL AND accelerated_recommendation_id IS NULL;
CREATE UNIQUE INDEX accelerated_cart_recommendation_unique ON public.cart_items(user_id, accelerated_recommendation_id)
  WHERE accelerated_recommendation_id IS NOT NULL;
-- Existing direct cart writes remain available for ordinary store items.
-- A reviewed binding can only be written by the server's service-role function.
CREATE POLICY accelerated_cart_direct_insert_guard ON public.cart_items AS RESTRICTIVE
  FOR INSERT TO public WITH CHECK (accelerated_recommendation_id IS NULL
    AND accelerated_reviewed_at IS NULL AND accelerated_variant_id IS NULL);
CREATE POLICY accelerated_cart_direct_update_guard ON public.cart_items AS RESTRICTIVE
  FOR UPDATE TO public USING (accelerated_recommendation_id IS NULL)
  WITH CHECK (accelerated_recommendation_id IS NULL AND accelerated_reviewed_at IS NULL
    AND accelerated_variant_id IS NULL);

ALTER TABLE public.orders
  ADD COLUMN accelerated_checkout_key uuid,
  ADD COLUMN accelerated_checkout_fingerprint text,
  ADD COLUMN accelerated_recommendation_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
CREATE UNIQUE INDEX accelerated_checkout_idempotency_unique ON public.orders(user_id, accelerated_checkout_key)
  WHERE accelerated_checkout_key IS NOT NULL;
ALTER TABLE public.order_items
  ADD COLUMN accelerated_recommendation_id uuid
    REFERENCES public.accelerated_member_recommendations(id) ON DELETE RESTRICT,
  ADD COLUMN accelerated_reviewed_at timestamptz;
ALTER TABLE public.order_items ADD CONSTRAINT accelerated_order_item_binding_complete CHECK
  ((accelerated_recommendation_id IS NULL) = (accelerated_reviewed_at IS NULL));
CREATE INDEX accelerated_order_item_recommendation_idx ON public.order_items(accelerated_recommendation_id)
  WHERE accelerated_recommendation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.accelerated_approve_member_recommendation(
  p_intake_id uuid, p_audit_id bigint, p_offer_kind text, p_offer_id text,
  p_title text, p_rationale text, p_reviewer uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_intake public.accelerated_decision_file_intakes%ROWTYPE;
  v_user_id uuid;
  v_id uuid;
  v_price numeric;
  v_updated_at timestamptz;
  v_variants jsonb := '[]'::jsonb;
  v_is_pod boolean;
  v_is_quote boolean;
BEGIN
  SELECT * INTO v_intake FROM public.accelerated_decision_file_intakes WHERE id = p_intake_id FOR UPDATE;
  IF NOT FOUND OR v_intake.review_status <> 'linked' OR v_intake.linked_audit_id IS DISTINCT FROM p_audit_id THEN
    RAISE EXCEPTION 'Link this Decision File to the reviewed assessment first' USING ERRCODE = 'P0001';
  END IF;
  SELECT user_id INTO v_user_id FROM public.accelerated_decision_file_owners WHERE intake_id = p_intake_id;
  IF NOT FOUND OR v_user_id IS DISTINCT FROM (SELECT user_id FROM public.diagnostic_audits WHERE id = p_audit_id) THEN
    RAISE EXCEPTION 'Verified member ownership is required' USING ERRCODE = 'P0001';
  END IF;
  IF p_offer_kind = 'service' THEN
    SELECT price, updated_at, (is_quote_based IS TRUE OR price IS NULL)
      INTO v_price, v_updated_at, v_is_quote FROM public.services
      WHERE id::text = p_offer_id AND is_active IS TRUE FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Offer is not active' USING ERRCODE = 'P0001'; END IF;
  ELSIF p_offer_kind = 'product' THEN
    SELECT price, updated_at, is_print_on_demand INTO v_price, v_updated_at, v_is_pod FROM public.products
      WHERE id::text = p_offer_id AND is_active IS TRUE FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Offer is not active' USING ERRCODE = 'P0001'; END IF;
    IF v_is_pod IS TRUE THEN
      PERFORM 1 FROM public.product_variants WHERE product_id::text = p_offer_id
        AND is_available IS TRUE FOR SHARE;
      IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id::text = p_offer_id
        AND is_available IS TRUE AND updated_at IS NULL) THEN
        RAISE EXCEPTION 'Variant revision is unavailable' USING ERRCODE = 'P0001';
      END IF;
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'price', price, 'updated_at', updated_at,
        'size', size, 'color', color)
        ORDER BY id), '[]'::jsonb) INTO v_variants
        FROM public.product_variants WHERE product_id::text = p_offer_id AND is_available IS TRUE;
      IF jsonb_array_length(v_variants) = 0 THEN
        RAISE EXCEPTION 'No available variants for this offer' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid offer kind' USING ERRCODE = '22023';
  END IF;
  IF v_updated_at IS NULL OR (p_offer_kind = 'product' AND v_price IS NULL)
    OR (v_price IS NOT NULL AND v_price < 0) THEN
    RAISE EXCEPTION 'Offer price or revision is unavailable' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.accelerated_member_recommendations
    (user_id,intake_id,audit_id,offer_kind,offer_id,title,rationale,review_status,reviewed_by,reviewed_at,
     approved_price,approved_offer_updated_at,approved_variant_prices,
     approved_is_quote_based,approved_is_print_on_demand)
  VALUES (v_user_id,p_intake_id,p_audit_id,p_offer_kind,p_offer_id,p_title,p_rationale,'approved',p_reviewer,now(),
          v_price,v_updated_at,v_variants,COALESCE(v_is_quote,false),COALESCE(v_is_pod,false))
  ON CONFLICT (intake_id,offer_kind,offer_id) DO UPDATE SET
    title = EXCLUDED.title, rationale = EXCLUDED.rationale, reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = now(), review_status = 'approved', approved_price = EXCLUDED.approved_price,
    approved_offer_updated_at = EXCLUDED.approved_offer_updated_at,
    approved_variant_prices = EXCLUDED.approved_variant_prices,
    approved_is_quote_based = EXCLUDED.approved_is_quote_based,
    approved_is_print_on_demand = EXCLUDED.approved_is_print_on_demand
  WHERE accelerated_member_recommendations.user_id = EXCLUDED.user_id
    AND accelerated_member_recommendations.audit_id = EXCLUDED.audit_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Recommendation source identity changed' USING ERRCODE = 'P0001'; END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_approve_member_recommendation(uuid,bigint,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_approve_member_recommendation(uuid,bigint,text,text,text,text,uuid) TO service_role;

CREATE FUNCTION public.accelerated_validate_member_offer(
  p_user_id uuid, p_recommendation_id uuid, p_reviewed_at timestamptz, p_variant_id bigint
) RETURNS TABLE(offer_kind text, offer_id text, unit_price numeric, quote_based boolean,
                variant_id bigint, printful_variant_id bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_rec public.accelerated_member_recommendations%ROWTYPE;
  v_price numeric;
  v_updated_at timestamptz;
  v_quote boolean;
  v_pod boolean;
  v_variant record;
  v_snapshot jsonb;
BEGIN
  SELECT r.* INTO v_rec FROM public.accelerated_member_recommendations r
    JOIN public.accelerated_decision_file_owners o ON o.intake_id = r.intake_id AND o.user_id = r.user_id
    JOIN public.accelerated_decision_file_intakes i ON i.id = r.intake_id
      AND i.review_status = 'linked' AND i.linked_audit_id = r.audit_id
    JOIN public.diagnostic_audits a ON a.id = r.audit_id AND a.user_id = r.user_id
    WHERE r.id = p_recommendation_id AND r.user_id = p_user_id
      AND r.review_status = 'approved' AND r.reviewed_at = p_reviewed_at
      AND r.approved_offer_updated_at IS NOT NULL
    FOR SHARE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recommendation is no longer approved for this member' USING ERRCODE = 'P0001'; END IF;
  IF v_rec.offer_kind = 'service' THEN
    IF p_variant_id IS NOT NULL THEN RAISE EXCEPTION 'Service cannot have a product variant' USING ERRCODE = 'P0001'; END IF;
    SELECT s.price, s.updated_at, (s.is_quote_based IS TRUE OR s.price IS NULL)
      INTO v_price, v_updated_at, v_quote FROM public.services s
      WHERE s.id::text = v_rec.offer_id AND s.is_active IS TRUE FOR SHARE;
    IF NOT FOUND OR v_updated_at IS DISTINCT FROM v_rec.approved_offer_updated_at
      OR v_price IS DISTINCT FROM v_rec.approved_price
      OR v_quote IS DISTINCT FROM v_rec.approved_is_quote_based THEN
      RAISE EXCEPTION 'Approved service changed; request a new review' USING ERRCODE = 'P0001';
    END IF;
    RETURN QUERY SELECT v_rec.offer_kind, v_rec.offer_id, v_price, v_quote, NULL::bigint, NULL::bigint;
    RETURN;
  END IF;
  IF v_rec.offer_kind <> 'product' THEN RAISE EXCEPTION 'Unsupported offer kind' USING ERRCODE = 'P0001'; END IF;
  SELECT p.price, p.updated_at, (p.is_print_on_demand IS TRUE)
    INTO v_price, v_updated_at, v_pod FROM public.products p
    WHERE p.id::text = v_rec.offer_id AND p.is_active IS TRUE FOR SHARE;
  IF NOT FOUND OR v_price IS NULL OR v_price IS DISTINCT FROM v_rec.approved_price
    OR v_updated_at IS DISTINCT FROM v_rec.approved_offer_updated_at
    OR v_pod IS DISTINCT FROM v_rec.approved_is_print_on_demand THEN
    RAISE EXCEPTION 'Approved product changed; request a new review' USING ERRCODE = 'P0001';
  END IF;
  IF v_pod THEN
    IF p_variant_id IS NULL THEN RAISE EXCEPTION 'Choose a product variant' USING ERRCODE = 'P0001'; END IF;
    SELECT pv.id, pv.price, pv.updated_at, pv.printful_variant_id INTO v_variant
      FROM public.product_variants pv WHERE pv.id = p_variant_id
      AND pv.product_id::text = v_rec.offer_id AND pv.is_available IS TRUE FOR SHARE;
    SELECT value INTO v_snapshot FROM jsonb_array_elements(v_rec.approved_variant_prices) AS item(value)
      WHERE (value->>'id')::bigint = p_variant_id;
    IF v_variant.id IS NULL OR v_snapshot IS NULL
      OR v_variant.price IS DISTINCT FROM (v_snapshot->>'price')::numeric
      OR v_variant.updated_at IS DISTINCT FROM (v_snapshot->>'updated_at')::timestamptz THEN
      RAISE EXCEPTION 'Approved product variant changed; request a new review' USING ERRCODE = 'P0001';
    END IF;
    RETURN QUERY SELECT v_rec.offer_kind, v_rec.offer_id, v_variant.price, false,
      v_variant.id, v_variant.printful_variant_id;
  ELSE
    IF p_variant_id IS NOT NULL THEN RAISE EXCEPTION 'Product has no approved variant' USING ERRCODE = 'P0001'; END IF;
    RETURN QUERY SELECT v_rec.offer_kind, v_rec.offer_id, v_price, false, NULL::bigint, NULL::bigint;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_validate_member_offer(uuid,uuid,timestamptz,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_validate_member_offer(uuid,uuid,timestamptz,bigint) TO service_role;

CREATE FUNCTION public.accelerated_select_member_recommendation(
  p_user_id uuid, p_recommendation_id uuid, p_reviewed_at timestamptz, p_variant_id bigint
) RETURNS TABLE(offer_kind text, offer_id text, unit_price numeric, quote_based boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_offer record;
BEGIN
  SELECT * INTO v_offer FROM public.accelerated_validate_member_offer(
    p_user_id,p_recommendation_id,p_reviewed_at,p_variant_id);
  IF v_offer.quote_based THEN
    RETURN QUERY SELECT v_offer.offer_kind, v_offer.offer_id, NULL::numeric, true;
    RETURN;
  END IF;
  INSERT INTO public.cart_items(user_id,product_id,service_id,quantity,
    accelerated_recommendation_id,accelerated_reviewed_at,accelerated_variant_id)
  VALUES (p_user_id,
    CASE WHEN v_offer.offer_kind = 'product' THEN v_offer.offer_id::bigint ELSE NULL END,
    CASE WHEN v_offer.offer_kind = 'service' THEN v_offer.offer_id::uuid ELSE NULL END,
    1,p_recommendation_id,p_reviewed_at,p_variant_id)
  ON CONFLICT (user_id,accelerated_recommendation_id)
    WHERE accelerated_recommendation_id IS NOT NULL
  DO UPDATE SET product_id = EXCLUDED.product_id, service_id = EXCLUDED.service_id,
    quantity = 1, accelerated_reviewed_at = EXCLUDED.accelerated_reviewed_at,
    accelerated_variant_id = EXCLUDED.accelerated_variant_id, updated_at = now();
  RETURN QUERY SELECT v_offer.offer_kind, v_offer.offer_id, v_offer.unit_price, false;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_select_member_recommendation(uuid,uuid,timestamptz,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_select_member_recommendation(uuid,uuid,timestamptz,bigint) TO service_role;

CREATE FUNCTION public.accelerated_checkout_member_cart(
  p_user_id uuid, p_checkout_key uuid, p_items jsonb,
  p_shipping_address jsonb, p_shipping_cost numeric
) RETURNS TABLE(order_id bigint, replay boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_existing record;
  v_item jsonb;
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_rec_id uuid;
  v_reviewed_at timestamptz;
  v_kind text;
  v_offer_id text;
  v_variant_id bigint;
  v_product record;
  v_service record;
  v_variant record;
  v_offer record;
  v_quantity integer;
  v_price numeric;
  v_subtotal numeric := 0;
  v_has_variant boolean := false;
  v_recommendations uuid[] := '{}'::uuid[];
  v_fingerprint text;
  v_order_id bigint;
BEGIN
  IF p_user_id IS NULL OR p_checkout_key IS NULL OR p_items IS NULL
    OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20
    OR p_shipping_cost IS NULL OR p_shipping_cost < 0 OR p_shipping_cost > 1000 THEN
    RAISE EXCEPTION 'Invalid checkout command' USING ERRCODE = '22023';
  END IF;
  v_fingerprint := md5(p_items::text || COALESCE(p_shipping_address::text,'') || p_shipping_cost::text);
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_checkout_key::text));
  SELECT id, accelerated_checkout_fingerprint INTO v_existing FROM public.orders
    WHERE user_id = p_user_id AND accelerated_checkout_key = p_checkout_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.accelerated_checkout_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Checkout key was already used for a different cart' USING ERRCODE = 'P0001';
    END IF;
    RETURN QUERY SELECT v_existing.id, true;
    RETURN;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_kind := v_item->>'itemType';
    v_quantity := (v_item->>'quantity')::integer;
    v_variant_id := NULLIF(v_item->>'variantId','')::bigint;
    v_rec_id := NULLIF(v_item->>'recommendationId','')::uuid;
    v_reviewed_at := NULLIF(v_item->>'reviewedAt','')::timestamptz;
    IF v_quantity IS NULL OR v_quantity NOT BETWEEN 1 AND 20 OR v_kind NOT IN ('product','service') THEN
      RAISE EXCEPTION 'Invalid cart item' USING ERRCODE = '22023';
    END IF;
    IF v_rec_id IS NOT NULL THEN
      IF v_reviewed_at IS NULL OR v_quantity <> 1 THEN
        RAISE EXCEPTION 'Recommendation selection changed; select it again' USING ERRCODE = 'P0001';
      END IF;
      IF v_rec_id = ANY(v_recommendations) THEN
        RAISE EXCEPTION 'Recommendation appears more than once in this cart' USING ERRCODE = 'P0001';
      END IF;
      SELECT * INTO v_offer FROM public.accelerated_validate_member_offer(
        p_user_id,v_rec_id,v_reviewed_at,v_variant_id);
      IF v_offer.quote_based OR v_offer.offer_kind <> v_kind
        OR (v_kind = 'product' AND v_offer.offer_id IS DISTINCT FROM v_item->>'productId')
        OR (v_kind = 'service' AND v_offer.offer_id IS DISTINCT FROM v_item->>'serviceId') THEN
        RAISE EXCEPTION 'Recommendation does not match this cart item' USING ERRCODE = 'P0001';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.cart_items c WHERE c.user_id = p_user_id
        AND c.accelerated_recommendation_id = v_rec_id AND c.accelerated_reviewed_at = v_reviewed_at
        AND c.accelerated_variant_id IS NOT DISTINCT FROM v_variant_id
        AND c.quantity = 1 AND c.product_id::text IS NOT DISTINCT FROM
          CASE WHEN v_kind = 'product' THEN v_offer.offer_id ELSE NULL END
        AND c.service_id::text IS NOT DISTINCT FROM
          CASE WHEN v_kind = 'service' THEN v_offer.offer_id ELSE NULL END) THEN
        RAISE EXCEPTION 'Recommendation was not selected in this member cart' USING ERRCODE = 'P0001';
      END IF;
      v_price := v_offer.unit_price;
      v_recommendations := array_append(v_recommendations,v_rec_id);
    ELSIF v_kind = 'product' THEN
      SELECT id, price, is_print_on_demand INTO v_product FROM public.products
        WHERE id::text = v_item->>'productId' AND is_active IS TRUE FOR SHARE;
      IF NOT FOUND OR v_product.price IS NULL OR v_product.price < 0 THEN
        RAISE EXCEPTION 'Product is unavailable' USING ERRCODE = 'P0001';
      END IF;
      IF v_product.is_print_on_demand IS TRUE THEN
        IF v_variant_id IS NULL THEN RAISE EXCEPTION 'Choose a merchandise variant' USING ERRCODE = 'P0001'; END IF;
        SELECT id, price, printful_variant_id INTO v_variant FROM public.product_variants
          WHERE id = v_variant_id AND product_id = v_product.id AND is_available IS TRUE FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Variant is unavailable' USING ERRCODE = 'P0001'; END IF;
        v_price := v_variant.price;
      ELSE
        IF v_variant_id IS NOT NULL THEN RAISE EXCEPTION 'Unexpected merchandise variant' USING ERRCODE = 'P0001'; END IF;
        v_price := v_product.price;
      END IF;
    ELSE
      IF v_variant_id IS NOT NULL THEN RAISE EXCEPTION 'Service cannot have a variant' USING ERRCODE = 'P0001'; END IF;
      SELECT price, is_quote_based INTO v_service FROM public.services
        WHERE id::text = v_item->>'serviceId' AND is_active IS TRUE FOR SHARE;
      IF NOT FOUND OR v_service.is_quote_based IS TRUE OR v_service.price IS NULL OR v_service.price < 0 THEN
        RAISE EXCEPTION 'Request a quote for this service' USING ERRCODE = 'P0001';
      END IF;
      v_price := v_service.price;
    END IF;
    IF v_rec_id IS NOT NULL AND v_variant_id IS NOT NULL THEN v_has_variant := true; END IF;
    IF v_rec_id IS NULL AND v_variant_id IS NOT NULL THEN v_has_variant := true; END IF;
    v_subtotal := v_subtotal + v_price * v_quantity;
    v_line := jsonb_build_object('kind',v_kind,'offer_id',
      CASE WHEN v_kind = 'product' THEN v_item->>'productId' ELSE v_item->>'serviceId' END,
      'variant_id',v_variant_id,'quantity',v_quantity,'price',v_price,
      'recommendation_id',v_rec_id,'reviewed_at',v_reviewed_at);
    v_lines := v_lines || jsonb_build_array(v_line);
  END LOOP;
  IF cardinality(v_recommendations) = 0 THEN
    RAISE EXCEPTION 'No approved recommendation in this checkout' USING ERRCODE = 'P0001';
  END IF;
  IF v_has_variant AND (p_shipping_address IS NULL OR jsonb_typeof(p_shipping_address) <> 'object'
    OR COALESCE(p_shipping_address->>'address1','') = '' OR COALESCE(p_shipping_address->>'zip','') = '') THEN
    RAISE EXCEPTION 'Shipping address required for merchandise' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_has_variant AND (p_shipping_cost <> 0 OR p_shipping_address IS NOT NULL) THEN
    RAISE EXCEPTION 'Unexpected shipping charge' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.orders(user_id,guest_email,guest_name,total_amount,discount_amount,
    final_amount,status,shipping_address,shipping_cost,tax,fulfillment_status,
    accelerated_checkout_key,accelerated_checkout_fingerprint,accelerated_recommendation_ids)
  VALUES (p_user_id,NULL,NULL,v_subtotal,0,v_subtotal+p_shipping_cost,
    CASE WHEN v_subtotal+p_shipping_cost > 0 THEN 'pending' ELSE 'completed' END,
    p_shipping_address,p_shipping_cost,0,CASE WHEN v_has_variant THEN 'pending' ELSE NULL END,
    p_checkout_key,v_fingerprint,v_recommendations)
  RETURNING id INTO v_order_id;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    INSERT INTO public.order_items(order_id,product_id,service_id,quantity,price_at_purchase,
      product_variant_id,printful_variant_id,accelerated_recommendation_id,accelerated_reviewed_at)
    VALUES (v_order_id,
      CASE WHEN v_line->>'kind' = 'product' THEN (v_line->>'offer_id')::bigint ELSE NULL END,
      CASE WHEN v_line->>'kind' = 'service' THEN (v_line->>'offer_id')::uuid ELSE NULL END,
      (v_line->>'quantity')::integer,(v_line->>'price')::numeric,
      (v_line->>'variant_id')::bigint,
      (SELECT printful_variant_id FROM public.product_variants WHERE id = (v_line->>'variant_id')::bigint),
      (v_line->>'recommendation_id')::uuid,(v_line->>'reviewed_at')::timestamptz);
  END LOOP;
  RETURN QUERY SELECT v_order_id, false;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_checkout_member_cart(uuid,uuid,jsonb,jsonb,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_checkout_member_cart(uuid,uuid,jsonb,jsonb,numeric) TO service_role;
