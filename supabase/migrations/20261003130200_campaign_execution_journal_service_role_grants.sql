-- Narrow the journal table privileges after Supabase default privileges granted
-- service_role more capabilities than the execution store requires.
revoke all on table public.campaign_execution_journal from service_role;
grant select, update on table public.campaign_execution_journal to service_role;
