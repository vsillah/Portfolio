begin;
-- Phase 9 is a private evidence boundary. No transports or application grants.
create table public.campaign_provider_attempt_bindings (
  run_id uuid primary key references public.campaign_provider_qualifications,
  attempt_id uuid not null, intent_id uuid not null, owner text not null,
  attempt_version bigint not null, intent_digest text not null,
  created_at timestamptz not null default clock_timestamp()
);
create table public.campaign_provider_adoptions (
  command_id uuid primary key,
  receipt_id uuid not null unique references public.campaign_provider_qualification_receipts,
  run_id uuid not null references public.campaign_provider_attempt_bindings,
  request jsonb not null, result jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
-- A resource cannot be adopted for another delivery, even across releases/runs.
create table public.campaign_provider_resource_claims (
  provider text not null, account_id text not null, environment text not null,
  resource_digest text not null, run_id uuid not null references public.campaign_provider_attempt_bindings,
  primary key(provider,account_id,environment,resource_digest)
);
alter table public.campaign_provider_attempt_bindings enable row level security;
alter table public.campaign_provider_adoptions enable row level security;
alter table public.campaign_provider_resource_claims enable row level security;
revoke all on public.campaign_provider_attempt_bindings, public.campaign_provider_adoptions,
  public.campaign_provider_resource_claims from public, anon, authenticated, service_role;

-- Explicit accounting projection: a bound qualification is a mirror, not a
-- second reservation. No API-role visibility; the future inspector must use the
-- effective columns rather than summing the qualification and campaign projections.
create view public.campaign_provider_budget_reconciliation with (security_invoker=true) as
select b.run_id,b.attempt_id,q.scope_digest,
  'campaign_execution_journal'::text as reservation_owner,
  q.reserved_cents as qualification_reserved_cents,q.spent_cents as qualification_spent_cents,
  (j.state->'attempts'->(q.scope->>'deliveryKey')->>'reservedCents')::bigint as effective_reserved_cents,
  (j.state->'attempts'->(q.scope->>'deliveryKey')->>'spentCents')::bigint as effective_spent_cents
from public.campaign_provider_attempt_bindings b
join public.campaign_provider_qualifications q on q.run_id=b.run_id
cross join public.campaign_execution_journal j where j.singleton;
revoke all on public.campaign_provider_budget_reconciliation from public, anon, authenticated, service_role;

create function public.campaign_preserve_provider_evidence() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Provider evidence is append-only'; end $$;
create trigger campaign_adoption_immutable before update or delete on public.campaign_provider_adoptions
  for each row execute function public.campaign_preserve_provider_evidence();
create trigger campaign_binding_immutable before update or delete on public.campaign_provider_attempt_bindings
  for each row execute function public.campaign_preserve_provider_evidence();
create trigger campaign_resource_immutable before update or delete on public.campaign_provider_resource_claims
  for each row execute function public.campaign_preserve_provider_evidence();
create trigger campaign_qualification_receipt_immutable before update or delete on public.campaign_provider_qualification_receipts
  for each row execute function public.campaign_preserve_provider_evidence();

-- Bind at preparation, never infer an old qualification's original attempt.
alter function public.campaign_prepare_provider_qualification(jsonb) rename to campaign_prepare_provider_qualification_v8;
create function public.campaign_prepare_provider_qualification(request jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare journal jsonb; attempt jsonb; run uuid; existed boolean;
begin
  select state into strict journal from public.campaign_execution_journal where singleton for update;
  existed := exists(select 1 from public.campaign_provider_qualifications where run_id=(request->>'runId')::uuid);
  if not existed and request->'scope'->>'mode'='controlled_delivery' and exists(
    select 1 from public.campaign_provider_qualifications q where q.scope->>'mode'='controlled_delivery'
      and q.scope->>'deliveryKey'=request->'scope'->>'deliveryKey') then
    raise exception 'Controlled delivery already reserved across environments';
  end if;
  run := public.campaign_prepare_provider_qualification_v8(request);
  if not existed and request->'scope'->>'mode'='controlled_delivery' then
    attempt := journal->'attempts'->(request->'scope'->>'deliveryKey');
    if attempt->'dispatchIntent'->>'mode' is distinct from 'disabled'
      or attempt->'dispatchIntent'->>'status' is distinct from 'prepared'
      or attempt->'reservedCents' is distinct from request->'scope'->'spendCapCents'
      or attempt->>'spentCents' is distinct from '0' or attempt ? 'receipt'
      or attempt->'callbacks' is distinct from '{}'::jsonb then raise exception 'Pristine controlled intent required'; end if;
    insert into public.campaign_provider_attempt_bindings(run_id,attempt_id,intent_id,owner,attempt_version,intent_digest)
      values(run,(attempt->>'id')::uuid,(attempt->'dispatchIntent'->>'id')::uuid,attempt->>'owner',
        (attempt->>'version')::bigint,public.campaign_authority_hash(attempt->'dispatchIntent'));
  end if;
  return run;
end $$;

-- Qualification accounting is a mirror of an already reserved campaign cap.
-- The effective budget is ALWAYS journal reserved+spent; never add this mirror.
-- Preserve qualification receipts/projections and append each settlement delta.
create function public.campaign_adopt_provider_receipt(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  journal jsonb; journal_version bigint; attempt jsonb; intent jsonb; action jsonb; canonical jsonb;
  run public.campaign_provider_qualifications; binding public.campaign_provider_attempt_bindings;
  proof public.campaign_provider_qualification_receipts; prior public.campaign_provider_adoptions;
  cert public.campaign_provider_certifications; scope jsonb; key text; outcome text; result jsonb;
  cmd_identity uuid := (request->>'commandId')::uuid; receipt_identity uuid := (request->>'receiptId')::uuid;
  eligible boolean := false; final_evidence boolean := false; reason text := ''; checked timestamptz; stamp text;
  old_spend bigint; old_reserve bigint; new_spend bigint; new_reserve bigint;
  receipt jsonb; resource_run uuid; evidence text;
begin
  if jsonb_typeof(request) is distinct from 'object'
    or (request - array['commandId','receiptId','runId','scope','attemptId','intentId','owner','expectedVersion','certificationId']) <> '{}'::jsonb
    or cmd_identity is null or receipt_identity is null or (request->>'runId')::uuid is null
    or (request->>'attemptId')::uuid is null or (request->>'intentId')::uuid is null
    or coalesce(request->>'expectedVersion','') !~ '^[1-9][0-9]*$'
    or length(btrim(coalesce(request->>'owner',''))) not between 1 and 200 then raise exception 'Exact adoption command required'; end if;
  scope := request->'scope'; perform public.campaign_validate_certification_scope(scope);
  if scope->>'mode'<>'controlled_delivery' or scope->>'environment'='local' or scope->>'provider'='sms'
    then raise exception 'Controlled provider readback required; SMS parked'; end if;
  -- Lock order: journal -> canonical -> sorted sources -> run -> certificate.
  select state,version into strict journal,journal_version from public.campaign_execution_journal where singleton for update;
  select * into prior from public.campaign_provider_adoptions a where a.command_id=cmd_identity or a.receipt_id=receipt_identity;
  if found then
    if prior.request is distinct from request then raise exception 'Conflicting adoption replay'; end if;
    return prior.result; -- historical result, never a fresh execution permit
  end if;
  key := scope->>'deliveryKey'; attempt := journal->'attempts'->key; intent := attempt->'dispatchIntent';
  if attempt is null or intent->'atomicRequest' is null
    or attempt->>'id' is distinct from request->>'attemptId' or intent->>'id' is distinct from request->>'intentId'
    or attempt->>'owner' is distinct from request->>'owner' or attempt->>'version' is distinct from request->>'expectedVersion'
    or attempt->>'releaseId' is distinct from scope->>'releaseId' or attempt->>'actionId' is distinct from scope->>'actionId'
    or attempt->>'manifestHash' is distinct from scope->>'manifestHash' or attempt->>'contentHash' is distinct from scope->>'contentHash'
    or attempt->>'authorizationKey' is distinct from scope->>'authorizationKey' or attempt->>'deliveryKey' is distinct from key
    then raise exception 'Exact current adoption fence required'; end if;
  select metadata into strict canonical from public.agent_runs where id=(scope->>'releaseId')::uuid and kind='campaign_release_manifest' for update;
  -- Lock/check sources before the qualification lock. Failures retain reservations.
  begin
    perform public.campaign_validate_atomic_recovery(intent->'atomicRequest' || jsonb_build_object(
      'record',journal->'releases'->(scope->>'releaseId'),'auditHash',intent->'approval'->>'auditHash',
      'deliveryKey',key,'authorizationKey',scope->>'authorizationKey','contentHash',scope->>'contentHash'));
    eligible := true;
  exception when others then reason := 'current_authority_requires_reconciliation'; end;
  select * into strict run from public.campaign_provider_qualifications where run_id=(request->>'runId')::uuid for update;
  select * into strict binding from public.campaign_provider_attempt_bindings where run_id=run.run_id;
  if run.scope is distinct from scope or run.scope_digest is distinct from public.campaign_authority_hash(scope)
    or run.stage<>'provider_readback' or binding.attempt_id::text is distinct from attempt->>'id'
    or binding.intent_id::text is distinct from intent->>'id' or binding.owner is distinct from attempt->>'owner'
    or binding.intent_digest is distinct from public.campaign_authority_hash(intent)
    or binding.attempt_version > (attempt->>'version')::bigint then raise exception 'Qualification attempt binding mismatch'; end if;
  select a into strict action from jsonb_array_elements(journal->'releases'->(scope->>'releaseId')->'manifest'->'actions') a where a->>'id'=scope->>'actionId';
  if scope->>'provider' is distinct from action->>'provider' or scope->>'operation' is distinct from action->>'operation'
    or scope->>'accountId' is distinct from action->>'accountId' or scope->>'receiptType' is distinct from action->>'expectedReceipt'
    or scope->'spendCapCents' is distinct from action->'maxSpendCents'
    or scope->>'destinationDigest' is distinct from public.campaign_authority_hash(jsonb_build_object('recipients',action->'recipients','metadata',action->'copy'->'metadata'))
    then raise exception 'Exact provider action required'; end if;
  select * into strict proof from public.campaign_provider_qualification_receipts r where r.receipt_id=receipt_identity and r.run_id=run.run_id;
  if proof.request->>'outcome' is distinct from run.state or proof.request->>'scopeDigest' is distinct from run.scope_digest
    or proof.request->>'verifierId' is distinct from scope->>'verifierId' or proof.request->>'verifierVersion' is distinct from scope->>'verifierVersion'
    or (proof.request->>'spentCents')::bigint is distinct from run.spent_cents
    or exists(select 1 from public.campaign_provider_qualification_receipts r where r.run_id=run.run_id and (r.created_at,r.receipt_id)>(proof.created_at,proof.receipt_id))
    then raise exception 'Latest exact qualification receipt required'; end if;
  if run.state='confirmed' then
    select * into strict cert from public.campaign_provider_certifications c where c.certification_id=(request->>'certificationId')::uuid and c.run_id=run.run_id for update;
    select public.campaign_authority_hash(jsonb_agg(r.request order by r.created_at,r.receipt_id)) into evidence
      from public.campaign_provider_qualification_receipts r where r.run_id=run.run_id;
    if cert.scope_digest is distinct from run.scope_digest or cert.evidence_digest is distinct from evidence
      or proof.request->'readbackComplete' is distinct from 'true'::jsonb then raise exception 'Exact completion certificate required'; end if;
  elsif request->>'certificationId' is not null then raise exception 'Certificate only for confirmed delivery'; end if;
  -- Recheck time-sensitive authority after ALL waits, without converting failures to permission.
  if eligible then
    begin
      perform public.campaign_validate_atomic_recovery(intent->'atomicRequest' || jsonb_build_object(
        'record',journal->'releases'->(scope->>'releaseId'),'auditHash',intent->'approval'->>'auditHash',
        'deliveryKey',key,'authorizationKey',scope->>'authorizationKey','contentHash',scope->>'contentHash'));
    exception when others then eligible := false; reason := 'current_authority_requires_reconciliation'; end;
  end if;
  checked := clock_timestamp(); stamp := to_char(checked at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  final_evidence := run.state in ('confirmed','rejected') and run.expires_at>checked
    and (run.state='rejected' or (cert.expires_at>checked and cert.revoked_at is null));
  if not coalesce(isfinite((attempt->>'leaseUntil')::timestamptz) and (attempt->>'leaseUntil')::timestamptz>checked,false)
    or run.expires_at<=checked or (run.state='confirmed' and (cert.expires_at<=checked or cert.revoked_at is not null))
    or attempt->>'state' not in ('claimed','submitted','reconciliation_required') then
    eligible := false; reason := 'fence_or_evidence_requires_reconciliation';
  end if;
  old_spend := (attempt->>'spentCents')::bigint; old_reserve := (attempt->>'reservedCents')::bigint;
  if old_spend<0 or old_reserve<0 or run.spent_cents<old_spend or run.spent_cents>(scope->>'spendCapCents')::bigint
    or old_spend+old_reserve is distinct from (scope->>'spendCapCents')::bigint
    then raise exception 'Campaign reservation mismatch'; end if;
  if proof.request->>'resourceDigest' is not null then
    insert into public.campaign_provider_resource_claims(provider,account_id,environment,resource_digest,run_id)
      values(scope->>'provider',scope->>'accountId',scope->>'environment',proof.request->>'resourceDigest',run.run_id) on conflict do nothing;
    select c.run_id into resource_run from public.campaign_provider_resource_claims c where c.provider=scope->>'provider'
      and c.account_id=scope->>'accountId' and c.environment=scope->>'environment' and c.resource_digest=proof.request->>'resourceDigest';
    if resource_run is distinct from run.run_id then raise exception 'Provider resource already adopted'; end if;
  end if;
  outcome := case when not eligible then 'reconciliation_required' else run.state end;
  -- Acceptance/uncertainty keep the full unspent campaign reservation. Qualification
  -- spend is provisional audit evidence until final authenticated completion/no-delivery.
  new_spend := old_spend; new_reserve := old_reserve;
  -- Known final costs can reconcile after stop/lease expiry without granting
  -- completion eligibility. Unknown or stale provider evidence retains the cap.
  if final_evidence then
    if run.state='rejected' and proof.request->'noDeliveryProven' is distinct from 'true'::jsonb then raise exception 'No-delivery evidence required'; end if;
    new_spend := run.spent_cents; new_reserve := 0;
    journal := jsonb_set(journal,'{ledger}',journal->'ledger' || jsonb_build_array(
      jsonb_build_object('attemptId',attempt->>'id','kind','release','cents',old_reserve,'at',stamp),
      jsonb_build_object('attemptId',attempt->>'id','kind','spend','cents',new_spend-old_spend,'at',stamp)));
  end if;
  attempt := attempt || jsonb_build_object('version',(attempt->>'version')::bigint+1,'spentCents',new_spend,'reservedCents',new_reserve,
    'state',case when outcome='confirmed' then 'confirmed' when outcome='accepted' then 'submitted' when outcome='rejected' then 'stopped'
      when attempt->>'state'='stopped' then 'stopped' else 'reconciliation_required' end);
  if outcome='confirmed' then
    receipt := jsonb_build_object('trust','provider_confirmed','provider',scope->>'provider','accountId',scope->>'accountId',
      'actionKey',key,'contentHash',scope->>'contentHash','receiptType',scope->>'receiptType',
      'providerId','sha256:' || (proof.request->>'resourceDigest'),'receivedAt',proof.request->>'observedAt');
    attempt := jsonb_set(attempt,'{receipt}',receipt);
  end if;
  attempt := jsonb_set(attempt,'{events}',attempt->'events' || jsonb_build_array(jsonb_build_object('at',stamp,'kind','provider_adoption_' || outcome,'evidenceId',cmd_identity)));
  journal := jsonb_set(journal,array['attempts',key],attempt);
  journal := jsonb_set(journal,'{version}',to_jsonb(journal_version+1));
  update public.campaign_execution_journal set state=journal,version=journal_version+1 where singleton;
  result := jsonb_build_object('protocol','campaign-provider-adoption/v1','commandId',cmd_identity,'receiptId',receipt_identity,
    'providerEnabled',false,'dispatched',false,'dispatchEligible',false,'outcome',outcome,'reason',reason,
    'completionRecorded',outcome='confirmed','spendSettled',final_evidence,'attempt',attempt,'journalVersion',journal_version+1,'checkedAt',stamp,
    'qualificationReservedCents',run.reserved_cents,'qualificationSpentCents',run.spent_cents,
    'campaignReservedCents',new_reserve,'campaignSpentCents',new_spend,'receiptDigest',public.campaign_authority_hash(proof.request));
  insert into public.campaign_provider_adoptions(command_id,receipt_id,run_id,request,result) values(cmd_identity,receipt_identity,run.run_id,request,result);
  return result;
end $$;

-- Only a durable exact adoption may satisfy a provider predecessor. This helper
-- runs under the caller's journal/canonical/source locks, then locks certificate.
create function public.campaign_provider_dependency_confirmed(attempt jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare adopted public.campaign_provider_adoptions; cert public.campaign_provider_certifications;
begin
  select a.* into adopted from public.campaign_provider_adoptions a
    where a.result->'attempt'->>'id'=attempt->>'id' and a.result->>'outcome'='confirmed';
  if not found or attempt->>'state' is distinct from 'confirmed'
    or adopted.result->'attempt' is distinct from attempt then return false; end if;
  select * into cert from public.campaign_provider_certifications c
    where c.certification_id=(adopted.request->>'certificationId')::uuid and c.run_id=adopted.run_id for update;
  return coalesce(cert.revoked_at is null and cert.expires_at>clock_timestamp()
    and exists(select 1 from public.campaign_provider_qualifications q where q.run_id=adopted.run_id
      and q.state='confirmed' and q.expires_at>clock_timestamp() and q.scope=adopted.request->'scope'),false);
end $$;

create or replace function public.campaign_authorize_sandbox_intent(request jsonb) returns jsonb
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
      -- Phase 9 accepts exact durable confirmed adoption as a predecessor.
      -- New intents remain disabled; accepted/uncertain evidence cannot qualify.
      or not (coalesce(receipt->>'trust' = 'synthetic' and coalesce(receipt->>'providerId','') like 'synthetic:%',false)
        or public.campaign_provider_dependency_confirmed(dep))
      or not coalesce((receipt->>'receivedAt')::timestamptz <= checked_at, false)
      then raise exception 'Dependency receipt mismatch'; end if;
    predecessors := predecessors || jsonb_build_object(dep_id, public.campaign_authority_hash(receipt));
  end loop;
  if public.campaign_authority_hash(predecessors) is distinct from request->>'dependencyDigest' then raise exception 'Dependency digest changed'; end if;
  -- Provider predecessor locks can wait past the earlier source/approval check.
  -- Recheck the authorization window after every dependency certificate is held.
  checked_at := clock_timestamp();
  stamp := to_char(checked_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  if (manifest->>'expiresAt')::timestamptz <= checked_at or exists(
    select 1 from jsonb_array_elements(manifest->'actions') a where (a->>'evidenceExpiresAt')::timestamptz <= checked_at)
    then raise exception 'Authority expired during dependency wait'; end if;
  for dep_id in select jsonb_array_elements_text(action->'dependsOn') loop
    select a into strict dep_action from jsonb_array_elements(manifest->'actions') a where a->>'id'=dep_id;
    dep := journal->'attempts'->(public.campaign_authority_keys(dep_action, record->>'hash')->>'deliveryKey');
    if dep->'receipt'->>'trust'='provider_confirmed' and not public.campaign_provider_dependency_confirmed(dep)
      then raise exception 'Dependency certificate expired during lock wait'; end if;
  end loop;
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

create or replace function public.campaign_validate_atomic_recovery(request jsonb) returns boolean
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
      -- Phase 9 accepts exact durable confirmed adoption as a predecessor.
      -- New intents remain disabled; accepted/uncertain evidence cannot qualify.
      or not (coalesce(receipt->>'trust' = 'synthetic' and coalesce(receipt->>'providerId','') like 'synthetic:%',false)
        or public.campaign_provider_dependency_confirmed(dep))
      or not coalesce((receipt->>'receivedAt')::timestamptz <= checked_at, false)
      then raise exception 'Dependency receipt mismatch'; end if;
    predecessors := predecessors || jsonb_build_object(dep_id, public.campaign_authority_hash(receipt));
  end loop;
  if public.campaign_authority_hash(predecessors) is distinct from request->>'dependencyDigest' then raise exception 'Dependency digest changed'; end if;
  -- Provider predecessor locks can wait past the earlier source/approval check.
  -- Recheck the authorization window after every dependency certificate is held.
  checked_at := clock_timestamp();
  stamp := to_char(checked_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  if (manifest->>'expiresAt')::timestamptz <= checked_at or exists(
    select 1 from jsonb_array_elements(manifest->'actions') a where (a->>'evidenceExpiresAt')::timestamptz <= checked_at)
    then raise exception 'Authority expired during dependency wait'; end if;
  for dep_id in select jsonb_array_elements_text(action->'dependsOn') loop
    select a into strict dep_action from jsonb_array_elements(manifest->'actions') a where a->>'id'=dep_id;
    dep := journal->'attempts'->(public.campaign_authority_keys(dep_action, record->>'hash')->>'deliveryKey');
    if dep->'receipt'->>'trust'='provider_confirmed' and not public.campaign_provider_dependency_confirmed(dep)
      then raise exception 'Dependency certificate expired during lock wait'; end if;
  end loop;
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

create or replace function public.campaign_recover_atomic_intent(request jsonb) returns jsonb
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
  -- Even a prepared controlled run can have lost its response before evidence
  -- import. Never recycle campaign money based only on the disabled intent.
  no_invocation := coalesce(not exists (
    select 1 from public.campaign_provider_qualifications q
    where q.scope->>'deliveryKey'=key and q.scope->>'mode'='controlled_delivery'
  ) and intent->>'mode' = 'disabled' and intent->>'status' = 'prepared'
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
  if exists(select 1 from public.campaign_provider_adoptions a where a.result->'attempt'->>'id'=attempt->>'id') then
    -- Adoption owns reconciliation; generic recovery never rewrites final receipts,
    -- frees money, renews or transfers an already/possibly delivered action.
    if operation <> 'inspect' and (attempt->>'version' is distinct from request->>'expectedVersion'
      or attempt->>'owner' is distinct from request->>'owner') then raise exception 'Recovery fence changed'; end if;
    safe := false; no_invocation := false; changed := false;
    reason := 'Provider adoption owns reconciliation; no resend or recovery takeover';
    outcome := case when operation='inspect' then 'inspected' else 'reconciliation_required' end;
  elsif operation = 'inspect' then
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

revoke all on function public.campaign_prepare_provider_qualification(jsonb),
  public.campaign_prepare_provider_qualification_v8(jsonb), public.campaign_adopt_provider_receipt(jsonb),
  public.campaign_provider_dependency_confirmed(jsonb), public.campaign_preserve_provider_evidence()
  from public, anon, authenticated, service_role;
commit;
