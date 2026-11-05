REVOKE ALL ON FUNCTION public.accelerated_quote_lineage_guard()
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.accelerated_quote_lineage_guard()
  TO service_role;
