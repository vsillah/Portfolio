-- A reviewed quote is a member-owned sales order, not a paid checkout.
-- This migration follows 20261105180647, which is already present on staging.
ALTER TABLE public.orders
  ADD COLUMN accelerated_quote_recommendation_id uuid
    REFERENCES public.accelerated_member_recommendations(id) ON DELETE RESTRICT,
  ADD COLUMN accelerated_quote_reviewed_at timestamptz,
  ADD CONSTRAINT accelerated_quote_order_binding_complete CHECK
    ((accelerated_quote_recommendation_id IS NULL) = (accelerated_quote_reviewed_at IS NULL)),
  ADD CONSTRAINT accelerated_quote_order_unpaid CHECK
    (accelerated_quote_recommendation_id IS NULL OR
      (status IN ('quote_pending', 'cancelled') AND total_amount = 0 AND final_amount = 0
       AND stripe_payment_intent_id IS NULL));

CREATE UNIQUE INDEX accelerated_quote_order_revision_unique
  ON public.orders(user_id, accelerated_quote_recommendation_id, accelerated_quote_reviewed_at)
  WHERE accelerated_quote_recommendation_id IS NOT NULL;

CREATE TABLE public.accelerated_quote_contact_links (
  order_id bigint PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  recommendation_id uuid NOT NULL REFERENCES public.accelerated_member_recommendations(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  contact_submission_id bigint NOT NULL UNIQUE REFERENCES public.contact_submissions(id) ON DELETE RESTRICT,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accelerated_quote_contact_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accelerated_quote_contact_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.accelerated_quote_contact_links TO service_role;

CREATE FUNCTION public.accelerated_create_member_quote_order(
  p_user_id uuid, p_recommendation_id uuid, p_reviewed_at timestamptz
) RETURNS TABLE(order_id bigint, replay boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_offer record; v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.accelerated_validate_member_offer(
    p_user_id,p_recommendation_id,p_reviewed_at,NULL);
  IF v_offer.offer_kind IS DISTINCT FROM 'service' OR v_offer.quote_based IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'This recommendation is not a current quote-based service' USING ERRCODE='P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_user_id::text || ':' || p_recommendation_id::text || ':' || p_reviewed_at::text, 0));
  SELECT * INTO v_order FROM public.orders o
    WHERE o.user_id=p_user_id AND o.accelerated_quote_recommendation_id=p_recommendation_id
      AND o.accelerated_quote_reviewed_at=p_reviewed_at FOR UPDATE;
  IF FOUND THEN
    IF v_order.status <> 'quote_pending' THEN
      RAISE EXCEPTION 'This quote request is no longer pending' USING ERRCODE='P0001';
    END IF;
    RETURN QUERY SELECT v_order.id, true;
    RETURN;
  END IF;
  INSERT INTO public.orders(user_id,total_amount,final_amount,status,
    accelerated_quote_recommendation_id,accelerated_quote_reviewed_at,
    accelerated_recommendation_ids)
  VALUES(p_user_id,0,0,'quote_pending',p_recommendation_id,p_reviewed_at,
    ARRAY[p_recommendation_id]) RETURNING * INTO v_order;
  INSERT INTO public.order_items(order_id,service_id,quantity,price_at_purchase,
    accelerated_recommendation_id,accelerated_reviewed_at)
  VALUES(v_order.id,v_offer.offer_id::uuid,1,0,p_recommendation_id,p_reviewed_at);
  RETURN QUERY SELECT v_order.id, false;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_create_member_quote_order(uuid,uuid,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_create_member_quote_order(uuid,uuid,timestamptz)
  TO service_role;

CREATE FUNCTION public.accelerated_submit_member_quote(
  p_user_id uuid, p_order_id bigint, p_name text, p_email text, p_message text
) RETURNS TABLE(contact_id bigint, replay boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_order public.orders%ROWTYPE; v_offer record; v_contact_id bigint;
  v_existing public.accelerated_quote_contact_links%ROWTYPE; v_account_email text;
BEGIN
  IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 1 AND 200
    OR length(btrim(coalesce(p_message,''))) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Name and message are required' USING ERRCODE='P0001';
  END IF;
  SELECT lower(email) INTO v_account_email FROM public.user_profiles WHERE id=p_user_id;
  IF v_account_email IS NULL OR v_account_email IS DISTINCT FROM lower(btrim(coalesce(p_email,''))) THEN
    RAISE EXCEPTION 'Quote contact must use the member account email' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_order FROM public.orders o WHERE o.id=p_order_id AND o.user_id=p_user_id
    AND o.status='quote_pending' AND o.accelerated_quote_recommendation_id IS NOT NULL
    AND o.accelerated_quote_reviewed_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote order is unavailable for this member' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_offer FROM public.accelerated_validate_member_offer(p_user_id,
    v_order.accelerated_quote_recommendation_id,v_order.accelerated_quote_reviewed_at,NULL);
  IF v_offer.offer_kind IS DISTINCT FROM 'service' OR v_offer.quote_based IS DISTINCT FROM true
    OR (SELECT count(*) FROM public.order_items oi WHERE oi.order_id=p_order_id
      AND oi.service_id::text=v_offer.offer_id
      AND oi.accelerated_recommendation_id=v_order.accelerated_quote_recommendation_id
      AND oi.accelerated_reviewed_at=v_order.accelerated_quote_reviewed_at) <> 1
    OR (SELECT count(*) FROM public.order_items oi WHERE oi.order_id=p_order_id) <> 1 THEN
    RAISE EXCEPTION 'Quote order no longer matches its reviewed service' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_existing FROM public.accelerated_quote_contact_links WHERE order_id=p_order_id;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.contact_submission_id, true;
    RETURN;
  END IF;
  INSERT INTO public.contact_submissions(name,email,message,lead_source)
    VALUES(btrim(p_name),v_account_email,btrim(p_message),'website_form')
    RETURNING id INTO v_contact_id;
  INSERT INTO public.accelerated_quote_contact_links(order_id,user_id,recommendation_id,
    reviewed_at,contact_submission_id,message)
    VALUES(p_order_id,p_user_id,v_order.accelerated_quote_recommendation_id,
      v_order.accelerated_quote_reviewed_at,v_contact_id,btrim(p_message));
  RETURN QUERY SELECT v_contact_id, false;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_submit_member_quote(uuid,bigint,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_submit_member_quote(uuid,bigint,text,text,text)
  TO service_role;

CREATE FUNCTION public.accelerated_quote_lineage_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_quote_id uuid;
BEGIN
  IF TG_TABLE_NAME='orders' THEN
    IF TG_OP='DELETE' AND OLD.accelerated_quote_recommendation_id IS NOT NULL THEN
      RAISE EXCEPTION 'Quote order lineage is immutable' USING ERRCODE='P0001';
    END IF;
    IF TG_OP='UPDATE' AND OLD.accelerated_quote_recommendation_id IS NOT NULL
      AND (NEW.user_id,NEW.accelerated_quote_recommendation_id,
        NEW.accelerated_quote_reviewed_at,NEW.accelerated_recommendation_ids)
        IS DISTINCT FROM
        (OLD.user_id,OLD.accelerated_quote_recommendation_id,
         OLD.accelerated_quote_reviewed_at,OLD.accelerated_recommendation_ids) THEN
      RAISE EXCEPTION 'Quote order lineage is immutable' USING ERRCODE='P0001';
    END IF;
  ELSE
    SELECT accelerated_quote_recommendation_id INTO v_quote_id FROM public.orders
      WHERE id=CASE WHEN TG_OP='INSERT' THEN NEW.order_id ELSE OLD.order_id END;
    IF v_quote_id IS NOT NULL THEN
      IF TG_OP='DELETE' OR (TG_OP='INSERT' AND EXISTS
        (SELECT 1 FROM public.order_items WHERE order_id=NEW.order_id)) OR
        (TG_OP='UPDATE' AND
          (NEW.order_id,NEW.service_id,NEW.product_id,NEW.quantity,NEW.price_at_purchase,
           NEW.accelerated_recommendation_id,NEW.accelerated_reviewed_at) IS DISTINCT FROM
          (OLD.order_id,OLD.service_id,OLD.product_id,OLD.quantity,OLD.price_at_purchase,
           OLD.accelerated_recommendation_id,OLD.accelerated_reviewed_at)) THEN
        RAISE EXCEPTION 'Quote order item lineage is immutable' USING ERRCODE='P0001';
      END IF;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER accelerated_quote_order_lineage_guard
  BEFORE UPDATE OR DELETE ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.accelerated_quote_lineage_guard();
CREATE TRIGGER accelerated_quote_item_lineage_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_items FOR EACH ROW
  EXECUTE FUNCTION public.accelerated_quote_lineage_guard();
