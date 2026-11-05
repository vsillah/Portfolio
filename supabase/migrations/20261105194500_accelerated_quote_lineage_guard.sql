-- Close the cross-order move path after the staging quote-order migration.
CREATE OR REPLACE FUNCTION public.accelerated_quote_lineage_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_quote_id uuid; v_quote_reviewed_at timestamptz; v_service_id text;
BEGIN
  IF TG_TABLE_NAME='orders' THEN
    IF TG_OP='DELETE' AND OLD.accelerated_quote_recommendation_id IS NOT NULL THEN
      RAISE EXCEPTION 'Quote order lineage is immutable' USING ERRCODE='P0001';
    END IF;
    IF TG_OP='UPDATE' THEN
      IF OLD.accelerated_quote_recommendation_id IS NULL
        AND NEW.accelerated_quote_recommendation_id IS NOT NULL THEN
        RAISE EXCEPTION 'Quote order lineage is immutable' USING ERRCODE='P0001';
      END IF;
      IF OLD.accelerated_quote_recommendation_id IS NOT NULL
        AND (NEW.user_id,NEW.accelerated_quote_recommendation_id,
          NEW.accelerated_quote_reviewed_at,NEW.accelerated_recommendation_ids)
          IS DISTINCT FROM
          (OLD.user_id,OLD.accelerated_quote_recommendation_id,
           OLD.accelerated_quote_reviewed_at,OLD.accelerated_recommendation_ids) THEN
        RAISE EXCEPTION 'Quote order lineage is immutable' USING ERRCODE='P0001';
      END IF;
    END IF;
  ELSE
    IF TG_OP IN ('INSERT','UPDATE') THEN
      SELECT o.accelerated_quote_recommendation_id,o.accelerated_quote_reviewed_at
        INTO v_quote_id,v_quote_reviewed_at FROM public.orders o WHERE o.id=NEW.order_id;
      IF v_quote_id IS NOT NULL THEN
        IF TG_OP='UPDATE' THEN
          SELECT o.accelerated_quote_recommendation_id INTO v_quote_id
            FROM public.orders o WHERE o.id=OLD.order_id;
          IF v_quote_id IS NULL THEN
            RAISE EXCEPTION 'Cannot move a line into a quote order' USING ERRCODE='P0001';
          END IF;
          SELECT o.accelerated_quote_recommendation_id INTO v_quote_id
            FROM public.orders o WHERE o.id=NEW.order_id;
        END IF;
        SELECT r.offer_id INTO v_service_id FROM public.accelerated_member_recommendations r
          WHERE r.id=v_quote_id AND r.offer_kind='service';
        IF v_service_id IS NULL OR NEW.service_id::text IS DISTINCT FROM v_service_id
          OR NEW.product_id IS NOT NULL OR NEW.quantity<>1 OR NEW.price_at_purchase<>0
          OR NEW.accelerated_recommendation_id IS DISTINCT FROM v_quote_id
          OR NEW.accelerated_reviewed_at IS DISTINCT FROM v_quote_reviewed_at
          OR (TG_OP='INSERT' AND EXISTS
            (SELECT 1 FROM public.order_items WHERE order_id=NEW.order_id)) THEN
          RAISE EXCEPTION 'Quote order item lineage is immutable' USING ERRCODE='P0001';
        END IF;
      END IF;
    END IF;
    IF TG_OP IN ('UPDATE','DELETE') THEN
      SELECT o.accelerated_quote_recommendation_id INTO v_quote_id
        FROM public.orders o WHERE o.id=OLD.order_id;
      IF v_quote_id IS NOT NULL THEN
        IF TG_OP='DELETE' THEN
          RAISE EXCEPTION 'Quote order item lineage is immutable' USING ERRCODE='P0001';
        END IF;
        IF (NEW.order_id,NEW.service_id,NEW.product_id,NEW.quantity,NEW.price_at_purchase,
          NEW.accelerated_recommendation_id,NEW.accelerated_reviewed_at) IS DISTINCT FROM
          (OLD.order_id,OLD.service_id,OLD.product_id,OLD.quantity,OLD.price_at_purchase,
           OLD.accelerated_recommendation_id,OLD.accelerated_reviewed_at) THEN
          RAISE EXCEPTION 'Quote order item lineage is immutable' USING ERRCODE='P0001';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
