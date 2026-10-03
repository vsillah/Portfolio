-- UNAPPLIED. Synthetic qualification only. No provider dispatch or existing-row rewrite.
-- Singleton intentionally serializes all delivery identities, including across releases.
-- Compatibility: additive; Phase 2 agent_runs metadata and local journals are untouched.
-- Rollback: disconnect consumers first; preserve/export journal before removing objects.
-- Never discard an uncertain claim/reservation to retry delivery.
create table public.campaign_execution_journal (
  singleton boolean primary key default true check (singleton),
  version bigint not null check (version >= 0),
  state jsonb not null,
  check (state->>'schemaVersion' = '1'),
  check ((state->>'version')::bigint = version),
  check (jsonb_typeof(state->'releases') = 'object'),
  check (jsonb_typeof(state->'attempts') = 'object'),
  check (jsonb_typeof(state->'ledger') = 'array'),
  check (octet_length(state::text) <= 8388608)
);
alter table public.campaign_execution_journal enable row level security;
revoke all on public.campaign_execution_journal from public, anon, authenticated;
grant select, update on public.campaign_execution_journal to service_role;
insert into public.campaign_execution_journal(singleton, version, state)
values (true, 0, '{"schemaVersion":1,"version":0,"releases":{},"attempts":{},"ledger":[]}');

create function public.campaign_execution_snapshot() returns jsonb
language sql security invoker set search_path = '' as $$
  select state from public.campaign_execution_journal where singleton = true;
$$;
create function public.campaign_execution_commit(expected_version bigint, next_state jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if expected_version is null or expected_version < 0 or next_state is null
    or (next_state->>'version')::bigint is distinct from expected_version + 1
    or next_state->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(next_state->'releases') is distinct from 'object'
    or jsonb_typeof(next_state->'attempts') is distinct from 'object'
    or jsonb_typeof(next_state->'ledger') is distinct from 'array' then
    raise exception 'Invalid campaign execution state';
  end if;
  update public.campaign_execution_journal set version = expected_version + 1, state = next_state
    where singleton = true and version = expected_version;
  return found;
end;
$$;
revoke all on function public.campaign_execution_snapshot() from public, anon, authenticated;
revoke all on function public.campaign_execution_commit(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.campaign_execution_snapshot() to service_role;
grant execute on function public.campaign_execution_commit(bigint, jsonb) to service_role;
