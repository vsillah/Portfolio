-- A submitted quote is terminal for member refinement; keep its contact package immutable.
CREATE FUNCTION public.accelerated_guard_submitted_quote_refinement() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.accelerated_quote_contact_links WHERE order_id=NEW.order_id) THEN
    RAISE EXCEPTION 'Quote request was already submitted' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.accelerated_guard_submitted_quote_refinement() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accelerated_guard_submitted_quote_refinement() TO service_role;
CREATE TRIGGER accelerated_submitted_quote_refinement_guard
  BEFORE INSERT ON public.accelerated_quote_refinements FOR EACH ROW
  EXECUTE FUNCTION public.accelerated_guard_submitted_quote_refinement();
