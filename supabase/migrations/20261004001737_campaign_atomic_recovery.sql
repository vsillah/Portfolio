-- Phase 7: unregistered sandbox recovery only. No hosted application.
begin;
-- Revalidate the Phase 6 contract without claiming, replaying or extending authority.
-- Same lock order: journal, canonical release, sorted sources.
create function public.campaign_validate_atomic_recovery(request jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  journal jsonb; journal_version bigint; record jsonb; manifest jsonb; action jsonb;
  source jsonb; source_row jsonb; keys jsonb; dep_action jsonb; dep jsonb; receipt jsonb;
  dep_id text; predecessors jsonb := '{}'; attempt jsonb; intent jsonb; binding jsonb;
  identity jsonb; request_identity jsonb; existing jsonb; item jsonb;
  total bigint := 0; reserve bigint; checked_at timestamptz; stamp text;
  release_id text; delivery_key text; request_id uuid;
begin
  if request is null or jsonb_typeof(request) is distinct from 'object'
    or coalesce(length(btrim(request->>'owner')), 0) not between 1 and 200
    or (request->>'journalVersion') is null or (request->>'journalVersion') !~ '^[0-9]+$'
    or (request->>'dependencyDigest') is null or (request->>'dependencyDigest') !~ '^[a-f0-9]{64}$'
    then raise exception 'Invalid authority request'; end if;
  release_id := (request->>'releaseId')::uuid::text;
  request_id := (request->>'requestId')::uuid;
  if request_id is null or release_id is null then raise exception 'Authority identity required'; end if;
  select version, state into strict journal_version, journal from public.campaign_execution_journal where singleton for update;
  select metadata into strict record from public.agent_runs where id = release_id::uuid and kind = 'campaign_release_manifest' for update;
  manifest := record->'manifest';
  -- Approved v1 records can only have pending -> approve. Hold/revise never resume,
  -- stop is terminal; repeated approve is an idempotent no-op in the canonical API.
  if record is distinct from request->'record' or record->>'state' is distinct from 'approved'
    or record->>'version' is distinct from '2' or request->>'approvalVersion' is distinct from '2'
    or jsonb_array_length(record->'audit') is distinct from 1
    or record->'audit'->0->>'decision' is distinct from 'approve'
    or coalesce(record->'audit'->0->>'actor', '') !~ '^(portfolio|slack):[^[:space:]]+$'
    or record->'audit'->0->>'hash' is distinct from record->>'hash'
    or manifest->>'schemaVersion' is distinct from 'campaign-release/v1'
    or manifest->>'releaseId' is distinct from release_id
    or record->>'hash' is distinct from request->>'hash'
    or public.campaign_authority_hash(manifest) is distinct from record->>'hash'
    or public.campaign_authority_hash(record->'audit') is distinct from request->>'auditHash'
    then raise exception 'Canonical approval changed or invalid'; end if;
  identity := jsonb_build_object('releaseId', release_id, 'manifestHash', record->>'hash', 'approvalVersion', 2, 'auditHash', request->>'auditHash');
  binding := journal->'approvalBindings'->release_id;
  if journal->'releases'->release_id is distinct from record or binding->>'status' is distinct from 'bound'
    or binding->'executionEnabled' is distinct from 'false'::jsonb
    or (binding - 'checkedAt' - 'status' - 'executionEnabled') is distinct from identity
    then raise exception 'Journal approval binding changed'; end if;

  -- Lock every approved source/evidence row, including planning inputs. Missing or
  -- newly changed evidence refuses the entire transaction. No arbitrary table reads.
  for source in select s from (
      select a->'source' s from jsonb_array_elements(manifest->'actions') a
      union all select p from jsonb_array_elements(coalesce(manifest->'planningSources', '[]')) p
    ) all_sources order by s->>'table', s->>'id'
  loop
    if coalesce(source->>'table', '') not in ('social_content_queue','outreach_queue','video_generation_jobs','attraction_campaigns','social_content_calendar_items','contact_submissions')
      then raise exception 'Source table unavailable'; end if;
    source_row := null;
    execute format('select to_jsonb(s) - ''updated_at'' from public.%I s where id = $1 for update', source->>'table')
      into source_row using (source->>'id')::uuid;
    if source_row is null or public.campaign_authority_hash(source_row) is distinct from source->>'fingerprint'
      then raise exception 'Source or evidence drift'; end if;
  end loop;
  -- Read real wall clock AFTER lock waits; never accept a caller's time.
  checked_at := clock_timestamp();
  stamp := to_char(checked_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  if not coalesce((manifest->>'createdAt')::timestamptz <= checked_at and (manifest->>'expiresAt')::timestamptz > checked_at
    and (record->'audit'->0->>'at')::timestamptz between (manifest->>'createdAt')::timestamptz and checked_at, false)
    then raise exception 'Authorization window invalid'; end if;
  for item in select a from jsonb_array_elements(manifest->'actions') a loop
    if not coalesce((item->>'evidenceExpiresAt')::timestamptz > checked_at, false) then raise exception 'Evidence expired'; end if;
  end loop;
  select a into strict action from jsonb_array_elements(manifest->'actions') a where a->>'id' = request->>'actionId';
  if not coalesce((action->>'scheduledFor')::timestamptz <= checked_at, false) then raise exception 'Schedule pending'; end if;
  keys := public.campaign_authority_keys(action, record->>'hash');
  if keys is distinct from jsonb_build_object('deliveryKey',request->'deliveryKey','authorizationKey',request->'authorizationKey','contentHash',request->'contentHash')
    then raise exception 'Immutable action keys changed'; end if;
  delivery_key := keys->>'deliveryKey';
  for dep_id in select jsonb_array_elements_text(action->'dependsOn') loop
    select a into strict dep_action from jsonb_array_elements(manifest->'actions') a where a->>'id' = dep_id;
    dep := journal->'attempts'->(public.campaign_authority_keys(dep_action, record->>'hash')->>'deliveryKey');
    receipt := dep->'receipt';
    if dep->>'state' is distinct from 'confirmed' or dep->>'releaseId' is distinct from release_id
      or dep->>'manifestHash' is distinct from record->>'hash'
      or dep->>'authorizationKey' is distinct from public.campaign_authority_keys(dep_action, record->>'hash')->>'authorizationKey'
      or dep->>'contentHash' is distinct from public.campaign_authority_keys(dep_action, record->>'hash')->>'contentHash'
      or receipt->>'actionKey' is distinct from dep->>'deliveryKey' or receipt->>'contentHash' is distinct from dep->>'contentHash'
      or receipt->>'provider' is distinct from dep_action->>'provider' or receipt->>'accountId' is distinct from dep_action->>'accountId'
      or receipt->>'receiptType' is distinct from dep_action->>'expectedReceipt'
      -- Phase 6 accepts synthetic predecessors only. Live/accepted/uncertain proof
      -- cannot unlock a sandbox claim. Provider certification remains separate.
      or receipt->>'trust' is distinct from 'synthetic' or coalesce(receipt->>'providerId','') not like 'synthetic:%'
      or not coalesce((receipt->>'receivedAt')::timestamptz <= checked_at, false)
      then raise exception 'Dependency receipt mismatch'; end if;
    predecessors := predecessors || jsonb_build_object(dep_id, public.campaign_authority_hash(receipt));
  end loop;
  if public.campaign_authority_hash(predecessors) is distinct from request->>'dependencyDigest' then raise exception 'Dependency digest changed'; end if;
  request_identity := request - 'record' - 'auditHash' - 'deliveryKey' - 'authorizationKey' - 'contentHash';
  existing := journal->'attempts'->delivery_key;
  -- Global request-id and delivery-key uniqueness, including across releases.
  if exists(select 1 from jsonb_each(journal->'attempts') a where a.key <> delivery_key and a.value->'dispatchIntent'->'atomicRequest'->>'requestId' = request_id::text)
    then raise exception 'Request identity already used'; end if;
  reserve := (action->>'maxSpendCents')::bigint;
  if reserve is null or reserve < 0 or reserve > 1000000 then raise exception 'Invalid reservation'; end if;
  for item in select value from jsonb_each(journal->'attempts') where value->>'releaseId' = release_id loop
    if coalesce(item->>'reservedCents','') !~ '^[0-9]+$' or coalesce(item->>'spentCents','') !~ '^[0-9]+$' then raise exception 'Invalid budget'; end if;
    total := total + (item->>'reservedCents')::bigint + (item->>'spentCents')::bigint;
  end loop;
  if not coalesce(total <= (manifest->>'spendCapCents')::bigint, false) then raise exception 'Budget exhausted'; end if;
  return true;
end $$;
-- Append-only command receipts live outside the legacy JSON snapshot so older
-- serializers cannot drop recovery history. No API role can mutate this table.
create table public.campaign_atomic_recovery_commands (
  command_id uuid primary key,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.campaign_atomic_recovery_commands enable row level security;
revoke all on public.campaign_atomic_recovery_commands from public, anon, authenticated, service_role;

create function public.campaign_recover_atomic_intent(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  journal jsonb; journal_version bigint; attempt jsonb; intent jsonb; record jsonb;
  original jsonb; prior record; review record; result jsonb; cmd_id uuid;
  operation text; reason text := ''; outcome text; checked_at timestamptz; stamp text;
  safe boolean := false; no_invocation boolean; changed boolean := false; key text;
begin
  if request is null or jsonb_typeof(request) is distinct from 'object'
    or coalesce(request->>'actor','') !~ '^portfolio:[^[:space:]]+$'
    or coalesce(request->>'owner','') = ''
    or coalesce(request->>'expectedVersion','') !~ '^[1-9][0-9]*$'
    or coalesce(request->>'operation','') not in ('inspect','renew','reconcile','release','review_takeover','takeover')
    then raise exception 'Invalid explicit recovery command'; end if;
  cmd_id := (request->>'commandId')::uuid;
  if cmd_id is null then raise exception 'Command identity required'; end if;
  operation := request->>'operation'; key := request->>'deliveryKey';
  select state, version into strict journal, journal_version from public.campaign_execution_journal where singleton for update;
  -- Idempotency is the historical result of this exact command, never fresh authority.
  select * into prior from public.campaign_atomic_recovery_commands c where c.command_id = cmd_id;
  if found then
    if prior.request is distinct from request then raise exception 'Conflicting recovery command replay'; end if;
    return prior.result;
  end if;
  attempt := journal->'attempts'->key; intent := attempt->'dispatchIntent'; original := intent->'atomicRequest';
  if original is null or attempt->>'id' is distinct from request->>'attemptId'
    or intent->>'id' is distinct from request->>'intentId'
    or attempt->>'releaseId' is distinct from request->>'releaseId'
    or attempt->>'manifestHash' is distinct from request->>'hash'
    or attempt->>'authorizationKey' is distinct from request->>'authorizationKey'
    or attempt->>'contentHash' is distinct from request->>'contentHash'
    or attempt->>'deliveryKey' is distinct from key
    then raise exception 'Exact committed atomic intent required'; end if;
  select metadata into record from public.agent_runs where id = (attempt->>'releaseId')::uuid and kind = 'campaign_release_manifest' for update;
  -- Inspection and reconciliation remain possible when approval has been revoked.
  -- Validation errors can only remove eligibility, never grant it.
  begin
    safe := public.campaign_validate_atomic_recovery(original || jsonb_build_object(
      'record',journal->'releases'->(attempt->>'releaseId'), 'auditHash',intent->'approval'->>'auditHash',
      'deliveryKey',key,'authorizationKey',attempt->>'authorizationKey','contentHash',attempt->>'contentHash'));
  exception when others then reason := SQLERRM; safe := false;
  end;
  if safe and (intent->'approval' is distinct from jsonb_build_object(
      'releaseId',attempt->>'releaseId','manifestHash',attempt->>'manifestHash','approvalVersion',2,
      'auditHash',public.campaign_authority_hash(record->'audit'))
    or intent->>'dependencyDigest' is distinct from original->>'dependencyDigest'
    or intent->>'sourceDigest' is distinct from public.campaign_authority_hash(
      (select jsonb_agg(a->'source') from jsonb_array_elements(record->'manifest'->'actions') a)
        || coalesce(record->'manifest'->'planningSources','[]'))
    or (attempt->>'state' = 'claimed' and attempt->'reservedCents' is distinct from intent->'reservedCents')) then
    safe := false; reason := 'Atomic intent identity or reservation changed';
  end if;
  checked_at := clock_timestamp();
  stamp := to_char(checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  -- Positive proof is deliberately limited to the disabled Phase 6 contract.
  -- Unknown fields/effects, receipts, callbacks or non-Phase-7 history retain money.
  no_invocation := coalesce(intent->>'mode' = 'disabled' and intent->>'status' = 'prepared'
    and attempt->>'state' in ('claimed','reconciliation_required','stopped')
    and attempt->>'spentCents' = '0' and attempt->>'tryCount' = '1'
    and not (attempt ? 'receipt') and not (attempt ? 'verification')
    and attempt->'callbacks' = '{}'::jsonb
    and (attempt - array['id','releaseId','actionId','manifestHash','deliveryKey','authorizationKey','contentHash',
      'owner','version','leaseUntil','state','tryCount','reservedCents','spentCents','events','dispatchIntent','callbacks']) = '{}'::jsonb
    and (intent - array['id','mode','status','approval','sourceDigest','dependencyDigest','journalVersion',
      'reservedCents','checkedAt','reason','atomicRequest']) = '{}'::jsonb
    and isfinite((attempt->>'leaseUntil')::timestamptz)
    and jsonb_array_length(attempt->'events') > 0
    and attempt->'events'->0->>'kind' = 'atomic_sandbox_authorized'
    and not exists(select 1 from jsonb_array_elements(attempt->'events') e
      where coalesce(e->>'kind','') not in ('atomic_sandbox_authorized','atomic_recovery_renewed',
        'atomic_recovery_takeover','atomic_recovery_reconciliation_required','atomic_recovery_released')), false);
  if operation = 'inspect' then
    outcome := 'inspected';
  else
    if attempt->>'version' is distinct from request->>'expectedVersion'
      or attempt->>'owner' is distinct from request->>'owner' then raise exception 'Recovery fence changed'; end if;
    if operation = 'reconcile' then
      outcome := 'reconciliation_required'; changed := attempt->>'state' <> 'stopped';
    elsif operation = 'release' then
      if no_invocation then outcome := 'released'; changed := attempt->>'state' <> 'stopped';
      else outcome := 'reconciliation_required'; changed := attempt->>'state' <> 'stopped'; reason := 'Provider outcome unknown; reservation retained'; end if;
    elsif not safe or not no_invocation or attempt->>'state' <> 'claimed' then
      outcome := 'reconciliation_required'; changed := attempt->>'state' <> 'stopped';
      reason := coalesce(nullif(reason,''),'Intent is not eligible; reservation retained');
    elsif operation = 'renew' then
      -- Expiry alone does not transfer ownership. The current owner may explicitly
      -- renew an expired disabled intent after all current authority checks pass.
      outcome := 'renewed'; changed := true;
    elsif operation = 'review_takeover' then
      if coalesce(request->>'newOwner','') = '' or request->>'newOwner' = attempt->>'owner'
        or coalesce(request->>'reviewNote','') = ''
        or (attempt->>'leaseUntil')::timestamptz > checked_at then raise exception 'Takeover review unavailable'; end if;
      outcome := 'takeover_reviewed';
    elsif operation = 'takeover' then
      select * into review from public.campaign_atomic_recovery_commands c where c.command_id = (campaign_recover_atomic_intent.request->>'reviewCommandId')::uuid;
      if not found or review.result->>'outcome' is distinct from 'takeover_reviewed'
        or review.request->>'operation' is distinct from 'review_takeover'
        or review.request->>'attemptId' is distinct from attempt->>'id'
        or review.request->>'intentId' is distinct from intent->>'id'
        or review.request->>'expectedVersion' is distinct from attempt->>'version'
        or review.request->>'owner' is distinct from attempt->>'owner'
        or review.request->>'newOwner' is distinct from request->>'newOwner'
        or coalesce(request->>'newOwner','') = '' or request->>'newOwner' = attempt->>'owner'
        or review.created_at + interval '5 minutes' <= checked_at
        or (attempt->>'leaseUntil')::timestamptz > checked_at
        then raise exception 'Distinct current takeover review required'; end if;
      outcome := 'takeover'; changed := true;
      attempt := jsonb_set(attempt,'{owner}',request->'newOwner');
    end if;
    if changed then
      if outcome in ('renewed','takeover') then
        attempt := jsonb_set(attempt,'{leaseUntil}',to_jsonb(to_char((checked_at + interval '60 seconds') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
      elsif outcome = 'released' then
        journal := jsonb_set(journal,'{ledger}',journal->'ledger' || jsonb_build_array(jsonb_build_object(
          'attemptId',attempt->>'id','kind','release','cents',attempt->'reservedCents','at',stamp)));
        attempt := attempt || '{"state":"stopped","reservedCents":0}'::jsonb;
      else
        attempt := jsonb_set(attempt,'{state}','"reconciliation_required"'::jsonb);
      end if;
      attempt := jsonb_set(attempt,'{version}',to_jsonb((attempt->>'version')::bigint + 1));
      attempt := jsonb_set(attempt,'{events}',attempt->'events' || jsonb_build_array(jsonb_build_object(
        'at',stamp,'kind',case when no_invocation then 'atomic_recovery_' || outcome else 'atomic_recovery_outcome_unknown' end,'evidenceId',cmd_id::text)));
      journal := jsonb_set(journal,array['attempts',key],attempt);
      journal := jsonb_set(journal,'{version}',to_jsonb(journal_version + 1));
      journal_version := journal_version + 1;
      update public.campaign_execution_journal set state=journal,version=journal_version where singleton;
    end if;
  end if;
  result := jsonb_build_object('protocol','campaign-atomic-recovery/v1','providerEnabled',false,'dispatched',false,
    'commandId',cmd_id::text,'requestDigest',public.campaign_authority_hash(request),'outcome',outcome,
    'eligible',safe,'noInvocationProven',no_invocation,'reason',reason,'attempt',attempt,'journalVersion',journal_version,'checkedAt',stamp);
  insert into public.campaign_atomic_recovery_commands(command_id,request,result) values(cmd_id,request,result);
  return result;
end $$;

create or replace function public.campaign_execution_commit(expected_version bigint, next_state jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_state jsonb; current_version bigint; atomic record; item record; release_id text;
begin
  select state,version into strict current_state,current_version from public.campaign_execution_journal where singleton for update;
  if expected_version is null or expected_version < 0 or next_state is null
    or (next_state->>'version')::bigint is distinct from expected_version + 1
    or next_state->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(next_state->'releases') is distinct from 'object'
    or jsonb_typeof(next_state->'attempts') is distinct from 'object'
    or jsonb_typeof(next_state->'ledger') is distinct from 'array' then raise exception 'Invalid campaign execution state'; end if;
  if current_version <> expected_version then return false; end if;
  for atomic in select key,value from jsonb_each(current_state->'attempts') where value->'dispatchIntent' ? 'atomicRequest' loop
    release_id := atomic.value->>'releaseId';
    if exists(select 1 from jsonb_each(next_state->'attempts') a where a.key <> atomic.key
      and (a.value->>'id'=atomic.value->>'id' or a.value->>'deliveryKey'=atomic.key
        or a.value->>'authorizationKey'=atomic.value->>'authorizationKey'))
      then raise exception 'Legacy CAS cannot alias atomic identity'; end if;
    if next_state->'releases'->release_id is distinct from current_state->'releases'->release_id
      or next_state->'approvalBindings'->release_id is distinct from current_state->'approvalBindings'->release_id
      then raise exception 'Atomic release history is immutable to legacy CAS'; end if;
    -- Protect every attempt on that release (dependencies and budget included).
    if (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(next_state->'attempts') where value->>'releaseId'=release_id or key=atomic.key)
      is distinct from (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(current_state->'attempts') where value->>'releaseId'=release_id or key=atomic.key)
      then raise exception 'Atomic attempts are immutable to legacy CAS'; end if;
    for item in select value from jsonb_each(current_state->'attempts') where value->>'releaseId'=release_id loop
      if (select coalesce(jsonb_agg(e order by n),'[]') from jsonb_array_elements(next_state->'ledger') with ordinality l(e,n) where e->>'attemptId'=item.value->>'id')
        is distinct from (select coalesce(jsonb_agg(e order by n),'[]') from jsonb_array_elements(current_state->'ledger') with ordinality l(e,n) where e->>'attemptId'=item.value->>'id')
        then raise exception 'Atomic ledger history is immutable to legacy CAS'; end if;
    end loop;
  end loop;
  if exists(select 1 from jsonb_each(next_state->'attempts') a where a.value->'dispatchIntent' ? 'atomicRequest'
    and a.value is distinct from current_state->'attempts'->a.key)
    then raise exception 'Legacy CAS cannot introduce atomic intents'; end if;
  update public.campaign_execution_journal set version=expected_version+1,state=next_state where singleton;
  return true;
end $$;
revoke all on function public.campaign_validate_atomic_recovery(jsonb), public.campaign_recover_atomic_intent(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.campaign_recover_atomic_intent(jsonb) to service_role;
commit;
