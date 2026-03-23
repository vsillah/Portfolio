-- RPC helpers for is_test_data column operations.
-- Bypasses PostgREST schema cache bug (supabase/supabase#42183) where newly
-- added columns are invisible to the REST API despite existing in Postgres.

-- Grant authenticator role access to tables with is_test_data so PostgREST
-- can eventually see the column once the cache bug is resolved.
GRANT ALL ON public.contact_submissions TO authenticator;
GRANT ALL ON public.outreach_queue TO authenticator;
GRANT ALL ON public.pain_point_evidence TO authenticator;
GRANT ALL ON public.meeting_records TO authenticator;
GRANT ALL ON public.client_projects TO authenticator;
GRANT ALL ON public.orders TO authenticator;
GRANT ALL ON public.order_items TO authenticator;
GRANT ALL ON public.chat_messages TO authenticator;

-- Set is_test_data flag on a row after insert (workaround for PostgREST not
-- recognising the column in insert payloads).
CREATE OR REPLACE FUNCTION set_test_data_flag(p_table text, p_id bigint, p_value boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format('UPDATE %I SET is_test_data = $1 WHERE id = $2', p_table)
  USING p_value, p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_test_data_flag TO service_role, authenticated;

-- Bulk-delete rows flagged as test data from a given table.
CREATE OR REPLACE FUNCTION cleanup_test_data(p_table text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  EXECUTE format('DELETE FROM %I WHERE is_test_data = true', p_table);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_test_data TO service_role;

NOTIFY pgrst, 'reload schema';
