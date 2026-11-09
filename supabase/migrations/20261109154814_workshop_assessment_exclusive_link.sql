-- The existing edition key keeps legacy Accelerated rows intact while exposing
-- a stable workshop identity for operator and member review.
ALTER TABLE public.accelerated_decision_file_intakes
  ADD COLUMN workshop_key text GENERATED ALWAYS AS (
    CASE
      WHEN content_version LIKE 'accelerated-%' THEN 'accelerated'
      WHEN content_version LIKE 'agentified-%' THEN 'agentified'
      ELSE NULL
    END
  ) STORED;
ALTER TABLE public.accelerated_decision_file_intakes
  ADD CONSTRAINT workshop_intake_known_identity CHECK (workshop_key IS NOT NULL);

-- A diagnostic assessment may be reviewed for one exact intake only.
CREATE UNIQUE INDEX workshop_intake_audit_exclusive_uidx
  ON public.accelerated_decision_file_intakes(linked_audit_id)
  WHERE linked_audit_id IS NOT NULL;

-- Existing recommendation IDs already travel through cart, Stripe order, and
-- quote records. Bind each new reviewed order to one originating intake.
ALTER TABLE public.orders
  ADD COLUMN workshop_intake_id uuid REFERENCES public.accelerated_decision_file_intakes(id) ON DELETE RESTRICT;

CREATE FUNCTION public.guard_workshop_order_intake() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_total integer;
  v_matched integer;
  v_intake_count integer;
  v_intake_id uuid;
BEGIN
  v_total := coalesce(cardinality(NEW.accelerated_recommendation_ids), 0);
  IF v_total = 0 THEN
    IF NEW.accelerated_quote_recommendation_id IS NOT NULL OR NEW.workshop_intake_id IS NOT NULL THEN
      RAISE EXCEPTION 'Reviewed order requires its recommendation lineage' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL OR v_total <> (SELECT count(DISTINCT id) FROM unnest(NEW.accelerated_recommendation_ids) AS ids(id)) THEN
    RAISE EXCEPTION 'Reviewed order identity is invalid' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.accelerated_quote_recommendation_id IS NOT NULL
     AND NOT (NEW.accelerated_quote_recommendation_id = ANY(NEW.accelerated_recommendation_ids)) THEN
    RAISE EXCEPTION 'Quote recommendation is outside this order' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*), count(DISTINCT r.intake_id), (array_agg(DISTINCT r.intake_id))[1]
    INTO v_matched, v_intake_count, v_intake_id
    FROM public.accelerated_member_recommendations r
    WHERE r.id = ANY(NEW.accelerated_recommendation_ids)
      AND r.user_id = NEW.user_id AND r.review_status = 'approved' AND r.intake_id IS NOT NULL;
  IF v_matched <> v_total OR v_intake_count <> 1 THEN
    RAISE EXCEPTION 'Reviewed offers must belong to one workshop intake' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.workshop_intake_id IS NOT NULL AND NEW.workshop_intake_id <> v_intake_id THEN
    RAISE EXCEPTION 'Workshop order intake changed' USING ERRCODE = 'P0001';
  END IF;
  NEW.workshop_intake_id := v_intake_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_workshop_order_intake() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_workshop_order_intake() TO service_role;
CREATE TRIGGER guard_workshop_order_intake
  BEFORE INSERT OR UPDATE OF user_id, accelerated_recommendation_ids, accelerated_quote_recommendation_id, workshop_intake_id
  ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_workshop_order_intake();

-- Project access remains operator controlled. A conversion attributed to a
-- workshop must trace to a paid Stripe order from that exact intake.
ALTER TABLE public.verified_client_project_memberships
  ADD COLUMN source_order_id bigint REFERENCES public.orders(id) ON DELETE RESTRICT,
  ADD COLUMN workshop_intake_id uuid REFERENCES public.accelerated_decision_file_intakes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT workshop_checkout_membership_complete CHECK (
    verification_source <> 'checkout_conversion' OR
    (source_order_id IS NOT NULL AND workshop_intake_id IS NOT NULL)
  );
CREATE UNIQUE INDEX workshop_checkout_membership_order_uidx
  ON public.verified_client_project_memberships(source_order_id)
  WHERE source_order_id IS NOT NULL;

CREATE FUNCTION public.guard_workshop_project_conversion() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_order record;
BEGIN
  IF NEW.verification_source <> 'checkout_conversion' THEN
    IF NEW.source_order_id IS NOT NULL OR NEW.workshop_intake_id IS NOT NULL THEN
      RAISE EXCEPTION 'Unattributed membership cannot claim workshop conversion' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  SELECT user_id, status, stripe_payment_intent_id, workshop_intake_id INTO v_order
    FROM public.orders WHERE id = NEW.source_order_id;
  IF NOT FOUND OR v_order.user_id IS DISTINCT FROM NEW.user_id
     OR v_order.status IS DISTINCT FROM 'completed'
     OR v_order.stripe_payment_intent_id IS NULL
     OR v_order.workshop_intake_id IS DISTINCT FROM NEW.workshop_intake_id THEN
    RAISE EXCEPTION 'Verified paid workshop order is required for conversion' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_workshop_project_conversion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_workshop_project_conversion() TO service_role;
CREATE TRIGGER guard_workshop_project_conversion
  BEFORE INSERT OR UPDATE OF user_id, verification_source, source_order_id, workshop_intake_id
  ON public.verified_client_project_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_workshop_project_conversion();
