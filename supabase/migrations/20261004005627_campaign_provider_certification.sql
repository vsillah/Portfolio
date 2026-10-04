begin;
-- Evidence is separate from the legacy snapshot: old serializers cannot erase it.
-- Mutators deliberately have NO API-role EXECUTE. An independently qualified
-- verifier/issuer and its action-time authority are prerequisites for future grants.
create table public.campaign_provider_qualifications (
  run_id uuid primary key,
  scope jsonb not null,
  scope_digest text not null,
  stage text not null check (stage in ('local_contract','hosted_contract','provider_readback')),
  approval_reference_id uuid not null,
  expires_at timestamptz not null,
  state text not null check (state in ('prepared','accepted','uncertain','confirmed','rejected')),
  reserved_cents bigint not null check (reserved_cents >= 0),
  spent_cents bigint not null default 0 check (spent_cents >= 0),
  created_at timestamptz not null default clock_timestamp(),
  unique(scope_digest,stage)
);
create unique index campaign_qualification_controlled_delivery on public.campaign_provider_qualifications
  ((scope->>'deliveryKey'),(scope->>'environment')) where scope->>'mode'='controlled_delivery';
create table public.campaign_provider_qualification_receipts (
  receipt_id uuid primary key,
  run_id uuid not null references public.campaign_provider_qualifications,
  request jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create table public.campaign_provider_certifications (
  certification_id uuid primary key,
  run_id uuid not null unique references public.campaign_provider_qualifications,
  scope_digest text not null,
  evidence_digest text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create table public.campaign_provider_certification_revocations (
  certification_id uuid primary key references public.campaign_provider_certifications,
  evidence_digest text not null check (evidence_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.campaign_provider_certification_revocations enable row level security;
revoke all on public.campaign_provider_certification_revocations from public, anon, authenticated, service_role;
alter table public.campaign_provider_qualifications enable row level security;
alter table public.campaign_provider_qualification_receipts enable row level security;
alter table public.campaign_provider_certifications enable row level security;
revoke all on public.campaign_provider_qualifications, public.campaign_provider_qualification_receipts,
  public.campaign_provider_certifications from public, anon, authenticated, service_role;

create function public.campaign_validate_certification_scope(scope jsonb) returns boolean
language plpgsql set search_path = '' as $$
declare field text; provider text := scope->>'provider'; operation text; receipt text;
begin
  if jsonb_typeof(scope) is distinct from 'object' or (scope - array['provider','operation','accountId','actionId','releaseId',
    'manifestHash','contentHash','deliveryKey','authorizationKey','destinationDigest','environment','credentialReferenceId',
    'credentialVersion','mode','spendCapCents','currency','receiptType','verifierId','verifierVersion']) <> '{}'::jsonb
    then raise exception 'Invalid certification scope'; end if;
  if provider in ('linkedin','instagram','facebook','x','tiktok','youtube') then operation := 'publish'; receipt := 'platform_post_id';
  elsif provider='gmail' then operation := 'send'; receipt := 'gmail_message_id';
  elsif provider='heygen' then operation := 'render'; receipt := 'heygen_video_id';
  elsif provider='manual_social' then operation := 'manual_handoff'; receipt := 'manual_confirmation';
  elsif provider='sms' then operation := 'send_sms'; receipt := 'sms_delivery_receipt';
  else raise exception 'Unknown provider'; end if;
  if scope->>'operation' is distinct from operation or scope->>'receiptType' is distinct from receipt
    or coalesce(scope->>'environment','') not in ('local','staging','production')
    or coalesce(scope->>'mode','') not in ('no_delivery','controlled_delivery')
    or scope->>'currency' is distinct from 'USD' or length(btrim(coalesce(scope->>'accountId',''))) not between 1 and 2000
    or coalesce(scope->>'spendCapCents','') !~ '^[0-9]+$' or (scope->>'spendCapCents')::numeric > 1000000
    then raise exception 'Invalid provider scope'; end if;
  foreach field in array array['actionId','releaseId','credentialReferenceId','verifierId'] loop
    if coalesce(scope->>field,'') !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' then raise exception 'Reference identity required'; end if;
  end loop;
  foreach field in array array['manifestHash','contentHash','destinationDigest'] loop
    if coalesce(scope->>field,'') !~ '^[a-f0-9]{64}$' then raise exception 'Digest required'; end if;
  end loop;
  foreach field in array array['credentialVersion','verifierVersion'] loop
    if coalesce(scope->>field,'') !~ '^[1-9][0-9]*$' or (scope->>field)::numeric > 9007199254740991 then raise exception 'Version required'; end if;
  end loop;
  if coalesce(scope->>'deliveryKey','') !~ '^campaign-action:[a-f0-9]{64}$'
    or coalesce(scope->>'authorizationKey','') !~ '^campaign-authorization:[a-f0-9]{64}$' then raise exception 'Action keys required'; end if;
  return true;
end $$;

-- A prepared run is an evidence plan, NOT an instruction/permit to invoke a provider.
-- Unique scope prevents a new run ID from recycling an uncertain delivery or budget.
create function public.campaign_prepare_provider_qualification(request jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare bound_scope jsonb := request->'scope'; existing public.campaign_provider_qualifications; run uuid := (request->>'runId')::uuid;
  expiry timestamptz := (request->>'expiresAt')::timestamptz; journal jsonb; attempt jsonb; intent jsonb; action jsonb;
begin
  perform public.campaign_validate_certification_scope(bound_scope);
  if bound_scope->>'provider'='sms' then raise exception 'SMS parked'; end if;
  if (request - array['runId','scope','stage','approvalReferenceId','expiresAt']) <> '{}'::jsonb
    or run is null or (request->>'approvalReferenceId')::uuid is null
    or coalesce(request->>'stage','') not in ('local_contract','hosted_contract','provider_readback')
    or not coalesce(isfinite(expiry) and expiry > clock_timestamp(),false)
    or (request->>'stage'='local_contract' and bound_scope->>'environment'<>'local')
    or (request->>'stage'='hosted_contract' and bound_scope->>'environment'='local')
    or (request->>'stage'='provider_readback' and bound_scope->>'environment'='local')
    or (request->>'stage'<>'provider_readback' and bound_scope->>'mode'<>'no_delivery')
    then raise exception 'Invalid qualification plan'; end if;
  -- Same first lock as authorization/recovery. A released campaign cannot race a
  -- new controlled qualification into a false no-invocation proof.
  select state into strict journal from public.campaign_execution_journal where singleton for update;
  -- Serialize scope reservation and exact request replay, including distinct run IDs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(public.campaign_authority_hash(bound_scope),0));
  select * into existing from public.campaign_provider_qualifications where run_id=run or (scope_digest=public.campaign_authority_hash(bound_scope) and stage=request->>'stage');
  if found then
    if existing.run_id is distinct from run or existing.scope is distinct from bound_scope or existing.stage is distinct from request->>'stage'
      or existing.approval_reference_id is distinct from (request->>'approvalReferenceId')::uuid or existing.expires_at is distinct from expiry
      then raise exception 'Conflicting qualification replay'; end if;
    return run;
  end if;
  if expiry <= clock_timestamp() then raise exception 'Qualification plan expired during lock wait'; end if;
  if bound_scope->>'mode'='controlled_delivery' then
    attempt := journal->'attempts'->(bound_scope->>'deliveryKey'); intent := attempt->'dispatchIntent';
    if attempt is null or intent->'atomicRequest' is null or attempt->>'state' is distinct from 'claimed'
      or attempt->>'manifestHash' is distinct from bound_scope->>'manifestHash'
      or attempt->>'releaseId' is distinct from bound_scope->>'releaseId'
      or attempt->>'authorizationKey' is distinct from bound_scope->>'authorizationKey'
      or attempt->>'contentHash' is distinct from bound_scope->>'contentHash'
      or not coalesce((attempt->>'leaseUntil')::timestamptz > clock_timestamp(),false)
      then raise exception 'Current atomic intent required for controlled qualification'; end if;
    select a into strict action from jsonb_array_elements(journal->'releases'->(bound_scope->>'releaseId')->'manifest'->'actions') a where a->>'id'=bound_scope->>'actionId';
    if bound_scope->>'provider' is distinct from action->>'provider' or bound_scope->>'operation' is distinct from action->>'operation'
      or bound_scope->>'accountId' is distinct from action->>'accountId' or bound_scope->>'receiptType' is distinct from action->>'expectedReceipt'
      or bound_scope->'spendCapCents' is distinct from action->'maxSpendCents'
      or bound_scope->>'destinationDigest' is distinct from public.campaign_authority_hash(jsonb_build_object('recipients',action->'recipients','metadata',action->'copy'->'metadata'))
      then raise exception 'Exact controlled provider action required'; end if;
    perform public.campaign_validate_atomic_recovery(intent->'atomicRequest' || jsonb_build_object(
      'record',journal->'releases'->(bound_scope->>'releaseId'),'auditHash',intent->'approval'->>'auditHash',
      'deliveryKey',bound_scope->>'deliveryKey','authorizationKey',bound_scope->>'authorizationKey','contentHash',bound_scope->>'contentHash'));
  end if;
  insert into public.campaign_provider_qualifications(run_id,scope,scope_digest,stage,approval_reference_id,expires_at,state,reserved_cents)
    values(run,bound_scope,public.campaign_authority_hash(bound_scope),request->>'stage',(request->>'approvalReferenceId')::uuid,expiry,'prepared',(bound_scope->>'spendCapCents')::bigint);
  return run;
end $$;

-- Private verified-evidence ingestion. Only the DB owner can currently call this.
-- The caller must independently authenticate/read back provider proof; these checks
-- bind that attestation, they do not implement provider-specific verification.
create function public.campaign_record_provider_qualification(request jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare run public.campaign_provider_qualifications; prior public.campaign_provider_qualification_receipts;
  receipt_identity uuid := (request->>'receiptId')::uuid; outcome text := request->>'outcome'; spend bigint;
begin
  select * into strict run from public.campaign_provider_qualifications where run_id=(request->>'runId')::uuid for update;
  select * into prior from public.campaign_provider_qualification_receipts r where r.receipt_id=receipt_identity;
  if found then
    if prior.request is distinct from request then raise exception 'Conflicting receipt replay'; end if;
    return prior.request->>'outcome';
  end if;
  if receipt_identity is null or jsonb_typeof(request) is distinct from 'object'
    or (request - array['receiptId','runId','scopeDigest','outcome','spentCents','evidenceDigest','resourceDigest',
      'verifierId','verifierVersion','observedAt','readbackComplete','noDeliveryProven']) <> '{}'::jsonb
    or request->>'scopeDigest' is distinct from run.scope_digest
    or request->>'verifierId' is distinct from run.scope->>'verifierId'
    or request->>'verifierVersion' is distinct from run.scope->>'verifierVersion'
    or coalesce(outcome,'') not in ('accepted','uncertain','confirmed','rejected')
    or coalesce(request->>'evidenceDigest','') !~ '^[a-f0-9]{64}$'
    or (coalesce(request->>'resourceDigest','') !~ '^[a-f0-9]{64}$'
      and not (request->>'resourceDigest' is null and outcome in ('uncertain','rejected')))
    or coalesce(request->>'spentCents','') !~ '^[0-9]+$'
    or not coalesce((request->>'observedAt')::timestamptz between date_trunc('milliseconds',run.created_at) and clock_timestamp(),false)
    or run.state in ('confirmed','rejected')
    then raise exception 'Invalid qualification receipt'; end if;
  spend := (request->>'spentCents')::bigint;
  if spend < run.spent_cents or spend > (run.scope->>'spendCapCents')::bigint then raise exception 'Qualification spend cap exceeded or regressed'; end if;
  if exists(select 1 from public.campaign_provider_qualification_receipts r where r.run_id=run.run_id
    and r.request->>'resourceDigest' is not null
    and r.request->>'resourceDigest' is distinct from campaign_record_provider_qualification.request->>'resourceDigest') then raise exception 'Provider resource identity changed'; end if;
  if outcome='confirmed' and (request->'readbackComplete' is distinct from 'true'::jsonb
      or (run.scope->>'mode'='no_delivery' and request->'noDeliveryProven' is distinct from 'true'::jsonb)
      or run.expires_at <= clock_timestamp()) then raise exception 'Current completion proof required'; end if;
  if outcome='rejected' and request->'noDeliveryProven' is distinct from 'true'::jsonb then raise exception 'No-delivery proof required to release budget'; end if;
  if run.state='uncertain' and outcome='accepted' then raise exception 'Uncertainty requires reconciliation'; end if;
  -- Acceptance never releases money or certifies completion. Unknown retains the
  -- unspent reservation; final readback settles cumulative spend exactly once.
  update public.campaign_provider_qualifications set state=outcome,spent_cents=spend,
    reserved_cents=case when outcome in ('confirmed','rejected') then 0 else (scope->>'spendCapCents')::bigint-spend end where run_id=run.run_id;
  insert into public.campaign_provider_qualification_receipts(receipt_id,run_id,request) values(receipt_identity,run.run_id,request);
  return outcome;
end $$;

create function public.campaign_issue_provider_certification(request jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare run public.campaign_provider_qualifications; prior public.campaign_provider_certifications; evidence text;
  cert uuid := (request->>'certificationId')::uuid; expiry timestamptz := (request->>'expiresAt')::timestamptz;
begin
  select * into strict run from public.campaign_provider_qualifications where run_id=(request->>'runId')::uuid for update;
  select * into prior from public.campaign_provider_certifications where run_id=run.run_id;
  if found then
    if prior.certification_id is distinct from cert or prior.expires_at is distinct from expiry then raise exception 'Conflicting certification replay'; end if;
    return cert; -- historical identity only, including after revocation/expiry
  end if;
  if cert is null or run.state<>'confirmed' or run.stage<>'provider_readback' or run.scope->>'provider'='sms'
    or not coalesce(isfinite(expiry) and expiry > clock_timestamp() and expiry <= run.expires_at,false)
    then raise exception 'Provider readback qualification required'; end if;
  select public.campaign_authority_hash(jsonb_agg(r.request order by r.created_at,r.receipt_id)) into evidence
    from public.campaign_provider_qualification_receipts r where r.run_id=run.run_id;
  if evidence is null then raise exception 'Evidence required'; end if;
  insert into public.campaign_provider_certifications(certification_id,run_id,scope_digest,evidence_digest,expires_at)
    values(cert,run.run_id,run.scope_digest,evidence,expiry);
  return cert;
end $$;

-- Revocation is permanent and evidenced; exact replay never unrevokes a scope.
create function public.campaign_revoke_provider_certification(request jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare identity uuid := (request->>'certificationId')::uuid; prior text;
begin
  if identity is null or coalesce(request->>'evidenceDigest','') !~ '^[a-f0-9]{64}$'
    then raise exception 'Exact revocation evidence required'; end if;
  perform 1 from public.campaign_provider_certifications where certification_id=identity for update;
  if not found then raise exception 'Unknown certification'; end if;
  select evidence_digest into prior from public.campaign_provider_certification_revocations where certification_id=identity;
  if found then
    if prior is distinct from request->>'evidenceDigest' then raise exception 'Conflicting revocation replay'; end if;
    return true;
  end if;
  insert into public.campaign_provider_certification_revocations(certification_id,evidence_digest) values(identity,request->>'evidenceDigest');
  update public.campaign_provider_certifications set revoked_at=clock_timestamp() where certification_id=identity;
  return true;
end $$;

-- Fresh database-clock inspection under the same journal -> canonical -> source
-- locks as Phase 7, then certificate lock. No cached inspection becomes a permit.
create function public.campaign_inspect_provider_certification(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare bound_scope jsonb := request->'scope'; journal jsonb; attempt jsonb; intent jsonb; action jsonb;
  cert public.campaign_provider_certifications; ready boolean := false; blocker text := 'certification_missing';
  next_action text := 'Qualify the exact provider scope with an approved verifier.'; checked timestamptz;
begin
  perform public.campaign_validate_certification_scope(bound_scope);
  select state into strict journal from public.campaign_execution_journal where singleton for update;
  attempt := journal->'attempts'->(bound_scope->>'deliveryKey'); intent := attempt->'dispatchIntent';
  if attempt is null or intent->'atomicRequest' is null or attempt->>'id' is distinct from request->>'attemptId'
    or intent->>'id' is distinct from request->>'intentId' or attempt->>'owner' is distinct from request->>'owner'
    or attempt->>'version' is distinct from request->>'expectedVersion'
    or attempt->>'releaseId' is distinct from bound_scope->>'releaseId' or attempt->>'manifestHash' is distinct from bound_scope->>'manifestHash'
    or attempt->>'actionId' is distinct from bound_scope->>'actionId' or attempt->>'contentHash' is distinct from bound_scope->>'contentHash'
    or attempt->>'authorizationKey' is distinct from bound_scope->>'authorizationKey' then raise exception 'Exact atomic fence required'; end if;
  select a into strict action from jsonb_array_elements(journal->'releases'->(bound_scope->>'releaseId')->'manifest'->'actions') a where a->>'id'=bound_scope->>'actionId';
  if bound_scope->>'provider' is distinct from action->>'provider' or bound_scope->>'operation' is distinct from action->>'operation'
    or bound_scope->>'accountId' is distinct from action->>'accountId' or bound_scope->>'receiptType' is distinct from action->>'expectedReceipt'
    or bound_scope->'spendCapCents' is distinct from action->'maxSpendCents'
    or bound_scope->>'destinationDigest' is distinct from public.campaign_authority_hash(jsonb_build_object('recipients',action->'recipients','metadata',action->'copy'->'metadata'))
    then raise exception 'Exact provider action required'; end if;
  begin
    perform public.campaign_validate_atomic_recovery(intent->'atomicRequest' || jsonb_build_object(
      'record',journal->'releases'->(bound_scope->>'releaseId'),'auditHash',intent->'approval'->>'auditHash',
      'deliveryKey',bound_scope->>'deliveryKey','authorizationKey',bound_scope->>'authorizationKey','contentHash',bound_scope->>'contentHash'));
    if attempt->>'state' is distinct from 'claimed' or intent->>'mode' is distinct from 'disabled' or intent->>'status' is distinct from 'prepared'
      or attempt->'reservedCents' is distinct from action->'maxSpendCents' or attempt->>'spentCents' is distinct from '0'
      or attempt ? 'receipt' or attempt ? 'verification' or attempt->'callbacks' is distinct from '{}'::jsonb
      then raise exception 'Atomic attempt requires recovery'; end if;
  exception when others then blocker := 'atomic_recovery_required'; next_action := 'Inspect and reconcile the exact atomic intent.';
  end;
  select c.* into cert from public.campaign_provider_certifications c
    join public.campaign_provider_qualifications q on q.run_id=c.run_id
    where c.scope_digest=public.campaign_authority_hash(bound_scope) and q.scope=bound_scope and q.state='confirmed' and q.stage='provider_readback'
    for update of c;
  -- Certificate lock waits must not extend approval/evidence lifetime.
  begin
    perform public.campaign_validate_atomic_recovery(intent->'atomicRequest' || jsonb_build_object(
      'record',journal->'releases'->(bound_scope->>'releaseId'),'auditHash',intent->'approval'->>'auditHash',
      'deliveryKey',bound_scope->>'deliveryKey','authorizationKey',bound_scope->>'authorizationKey','contentHash',bound_scope->>'contentHash'));
  exception when others then blocker := 'atomic_recovery_required'; next_action := 'Inspect and reconcile the exact atomic intent.';
  end;
  checked := clock_timestamp();
  if (attempt->>'leaseUntil')::timestamptz <= checked then blocker := 'atomic_recovery_required'; next_action := 'Inspect and renew the disabled intent through recovery.'; end if;
  if blocker <> 'atomic_recovery_required' then
    if cert.certification_id is not null and cert.revoked_at is null and cert.expires_at>checked then
      if bound_scope->>'mode'='controlled_delivery' then
        blocker := 'qualification_delivery_requires_reconciliation';
        next_action := 'Reconcile the qualification resource with the campaign journal before any further action.';
      else
        ready := true; blocker := 'provider_disabled'; next_action := 'Obtain separate activation review; this inspection grants no dispatch authority.';
      end if;
    elsif cert.certification_id is not null then blocker := 'certification_expired_or_revoked'; next_action := 'Review fresh qualification evidence; do not replay delivery.';
    end if;
  end if;
  if exists(select 1 from public.campaign_provider_qualifications q where q.scope->>'deliveryKey'=bound_scope->>'deliveryKey'
    and q.scope->>'mode'='controlled_delivery') then
    ready := false; blocker := 'qualification_delivery_requires_reconciliation';
    next_action := 'Reconcile the qualification resource with the campaign journal before any further action.';
  end if;
  return jsonb_build_object('protocol','campaign-provider-certification/v1','providerEnabled',false,'dispatched',false,'dispatchEligible',false,
    'certificationReady',ready,'scopeDigest',public.campaign_authority_hash(bound_scope),'attemptId',attempt->>'id','attemptVersion',attempt->'version',
    'checkedAt',to_char(checked at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'blocker',blocker,'nextAction',next_action,
    'certificationId',cert.certification_id,'evidenceDigest',cert.evidence_digest);
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

revoke all on function public.campaign_validate_certification_scope(jsonb), public.campaign_prepare_provider_qualification(jsonb),
  public.campaign_record_provider_qualification(jsonb), public.campaign_issue_provider_certification(jsonb),
  public.campaign_revoke_provider_certification(jsonb), public.campaign_inspect_provider_certification(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.campaign_inspect_provider_certification(jsonb) to service_role;
commit;
