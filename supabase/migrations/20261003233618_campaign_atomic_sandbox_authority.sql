-- Phase 6. UNAPPLIED to hosted databases. Sandbox intents only; no provider transport.
-- Lock order: singleton journal, canonical agent_runs row, sorted source rows.
-- Ordinary canonical/source UPDATE/DELETE operations take conflicting row locks.
-- Auth commit is the linearization point; later stop does not erase historical intent.
-- No receipt is a live-provider permit. See docs/campaign-autopilot/phase6.md.
begin;

-- JS canonicalReleaseValue parity for the admitted JSON domain. Unsupported numeric
-- encodings/key order fail hash equality closed, never normalize approved content.
create function public.campaign_authority_json(value jsonb) returns text
language plpgsql immutable strict security invoker set search_path = '' as $$
declare result text;
begin
  case jsonb_typeof(value)
    when 'object' then
      select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || public.campaign_authority_json(val), ',' order by key collate "C"), '') || '}'
        into result from jsonb_each(value) as e(key,val);
    when 'array' then
      select '[' || coalesce(string_agg(public.campaign_authority_json(val), ',' order by ordinal), '') || ']'
        into result from jsonb_array_elements(value) with ordinality as e(val,ordinal);
    when 'number' then result := trim_scale((value::text)::numeric)::text;
    else result := value::text;
  end case;
  return result;
end $$;
create function public.campaign_authority_hash(value jsonb) returns text
language sql immutable strict security invoker set search_path = '' as $$
  select encode(sha256(convert_to(public.campaign_authority_json(value), 'UTF8')), 'hex');
$$;
create function public.campaign_authority_keys(action jsonb, manifest_hash text) returns jsonb
language sql immutable strict security invoker set search_path = '' as $$
  select jsonb_build_object(
    'contentHash', public.campaign_authority_hash(jsonb_build_object('copy', action->'copy', 'assets', action->'assets')),
    'authorizationKey', 'campaign-authorization:' || public.campaign_authority_hash(jsonb_build_array(manifest_hash, action->>'id')),
    'deliveryKey', 'campaign-action:' || public.campaign_authority_hash(jsonb_build_object(
      'provider', action->'provider', 'accountId', action->'accountId', 'operation', action->'operation',
      'source', jsonb_build_object('table', action->'source'->'table', 'id', action->'source'->'id'),
      'recipients', coalesce((select jsonb_agg(lower(btrim(r->>'address')) order by lower(btrim(r->>'address')) collate "C") from jsonb_array_elements(action->'recipients') r), '[]'::jsonb))));
$$;

-- SECURITY DEFINER is confined to these service-role RPCs so table UPDATE can be
-- revoked. All relations are qualified, source identifiers strictly allowlisted,
-- and PUBLIC/anon/authenticated EXECUTE revoked in this same migration transaction.
create function public.campaign_authorize_sandbox_intent(request jsonb) returns jsonb
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
  if existing is not null then
    if existing->'dispatchIntent'->>'status' is distinct from 'prepared'
      or existing->'dispatchIntent'->'atomicRequest' is distinct from request_identity
      or existing->>'owner' is distinct from request->>'owner' or existing->>'version' is distinct from '1'
      or existing->>'state' is distinct from 'claimed' or existing->>'reservedCents' is distinct from reserve::text
      or not coalesce((existing->>'leaseUntil')::timestamptz > checked_at, false)
      or journal_version <> (request->>'journalVersion')::bigint + 1
      then raise exception 'Duplicate delivery or stale ownership; inspect intent'; end if;
    attempt := existing;
  else
    if journal_version <> (request->>'journalVersion')::bigint then raise exception 'Journal CAS conflict'; end if;
    total := total + reserve;
  end if;
  if not coalesce(total <= (manifest->>'spendCapCents')::bigint, false) then raise exception 'Budget exhausted'; end if;
  if existing is null then
    intent := jsonb_build_object('id', gen_random_uuid()::text, 'mode','disabled','status','prepared',
      'approval', identity, 'sourceDigest', public.campaign_authority_hash(
        (select jsonb_agg(a->'source') from jsonb_array_elements(manifest->'actions') a) || coalesce(manifest->'planningSources','[]')),
      'dependencyDigest', public.campaign_authority_hash(predecessors), 'journalVersion', journal_version + 1,
      'reservedCents', reserve, 'checkedAt', stamp, 'reason','Atomic sandbox intent qualified. Provider dispatch disabled.', 'atomicRequest',request_identity);
    attempt := jsonb_build_object('id',gen_random_uuid()::text,'releaseId',release_id,'actionId',action->>'id','manifestHash',record->>'hash',
      'owner',request->>'owner','version',1,'leaseUntil',to_char((checked_at + interval '60 seconds') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'state','claimed','tryCount',1,'reservedCents',reserve,'spentCents',0,'callbacks','{}'::jsonb,
      'events',jsonb_build_array(jsonb_build_object('at',stamp,'kind','atomic_sandbox_authorized')),'dispatchIntent',intent) || keys;
    journal := jsonb_set(journal, array['attempts',delivery_key], attempt);
    journal := jsonb_set(journal, '{ledger}', journal->'ledger' || jsonb_build_array(jsonb_build_object('attemptId',attempt->>'id','kind','reserve','cents',reserve,'at',stamp)));
    journal := jsonb_set(journal, '{version}', to_jsonb(journal_version + 1));
    update public.campaign_execution_journal set state = journal, version = journal_version + 1 where singleton;
  end if;
  return jsonb_build_object('protocol','campaign-atomic-sandbox/v1','providerEnabled',false,'attempt',attempt);
end $$;

-- Legacy CAS can still qualify synthetic journals. It cannot create, erase or edit
-- atomic receipts, or mutate ANY journal containing one. Recovery is inspect-only
-- until a separately reviewed atomic recovery operation exists.
create or replace function public.campaign_execution_commit(expected_version bigint, next_state jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_state jsonb; current_version bigint;
begin
  select state, version into strict current_state, current_version from public.campaign_execution_journal where singleton for update;
  if expected_version is null or expected_version < 0 or next_state is null
    or (next_state->>'version')::bigint is distinct from expected_version + 1
    or next_state->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(next_state->'releases') is distinct from 'object'
    or jsonb_typeof(next_state->'attempts') is distinct from 'object'
    or jsonb_typeof(next_state->'ledger') is distinct from 'array' then raise exception 'Invalid campaign execution state'; end if;
  if exists(select 1 from jsonb_each(current_state->'attempts') a where a.value->'dispatchIntent' ? 'atomicRequest')
    or exists(select 1 from jsonb_each(next_state->'attempts') a where a.value->'dispatchIntent' ? 'atomicRequest')
    then raise exception 'Atomic intents require dedicated recovery; legacy CAS disabled'; end if;
  if current_version <> expected_version then return false; end if;
  update public.campaign_execution_journal set version = expected_version + 1, state = next_state where singleton;
  return true;
end $$;
revoke all on function public.campaign_authority_json(jsonb), public.campaign_authority_hash(jsonb), public.campaign_authority_keys(jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.campaign_authorize_sandbox_intent(jsonb), public.campaign_execution_commit(bigint,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.campaign_authorize_sandbox_intent(jsonb), public.campaign_execution_commit(bigint,jsonb) to service_role;
revoke all on public.campaign_execution_journal from service_role;
grant select on public.campaign_execution_journal to service_role;
commit;
