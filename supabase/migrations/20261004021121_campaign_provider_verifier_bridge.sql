begin;
create schema campaign_verifier;
revoke all on schema campaign_verifier from public, anon, authenticated, service_role;
-- Empty owner-managed metadata projections. No credential values or resolver paths.
create table campaign_verifier.identities (
  principal name primary key,
  verifier_id uuid not null unique,
  version bigint not null check(version > 0),
  active boolean not null default false,
  check(principal::text not in ('postgres','authenticator','anon','authenticated','service_role'))
);
create table campaign_verifier.credential_references (
  reference_id uuid primary key,
  version bigint not null check(version > 0),
  provider text not null,
  account_digest text not null check(account_digest ~ '^[a-f0-9]{64}$'),
  environment text not null check(environment in ('staging','production')),
  active boolean not null default false
);
-- An owner-installed authorization is exclusively for inspecting one existing
-- resource; its qualification must already be bound to a pristine atomic intent.
create table campaign_verifier.authorizations (
  run_id uuid primary key references public.campaign_provider_attempt_bindings,
  scope_digest text not null check(scope_digest ~ '^[a-f0-9]{64}$'),
  approval_reference_id uuid not null,
  resource_digest text not null check(resource_digest ~ '^[a-f0-9]{64}$'),
  not_before timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check(isfinite(not_before) and isfinite(expires_at) and expires_at > not_before)
);
create table campaign_verifier.evidence (
  command_id uuid primary key,
  run_id uuid not null references campaign_verifier.authorizations,
  principal name not null,
  request_digest text not null,
  receipt_id uuid not null unique references public.campaign_provider_qualification_receipts,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index campaign_verifier_evidence_run_idx on campaign_verifier.evidence(run_id,created_at);
alter table campaign_verifier.identities enable row level security;
alter table campaign_verifier.credential_references enable row level security;
alter table campaign_verifier.authorizations enable row level security;
alter table campaign_verifier.evidence enable row level security;
revoke all on all tables in schema campaign_verifier from public, anon, authenticated, service_role;
create trigger campaign_verifier_evidence_immutable before update or delete on campaign_verifier.evidence
  for each row execute function public.campaign_preserve_provider_evidence();

-- A future dedicated LOGIN receives only USAGE and EXECUTE after separate review.
-- session_user is the authenticated connection identity, never a JWT/body/GUC.
-- SECURITY DEFINER is needed to compose owner-only Phase 8/9 functions atomically.
create function campaign_verifier.ingest(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  identity campaign_verifier.identities; credential campaign_verifier.credential_references;
  authority campaign_verifier.authorizations; prior campaign_verifier.evidence;
  qualification public.campaign_provider_qualifications; journal jsonb; attempt jsonb; intent jsonb;
  scope jsonb := request->'scope'; observation jsonb := request->'observation';
  command uuid; receipt uuid; certificate uuid; outcome text; result jsonb; checked timestamptz;
  observed timestamptz; certificate_expiry timestamptz; binding public.campaign_provider_attempt_bindings;
begin
  -- Map only a dedicated connection identity. SET ROLE and user-editable claims
  -- cannot impersonate this identity. No LOGIN, membership or grants ship here.
  select * into strict identity from campaign_verifier.identities where principal=session_user;
  if jsonb_typeof(request) is distinct from 'object'
    or (request - array['commandId','receiptId','certificationId','scope','runId','attemptId','intentId','owner','expectedVersion','observation']) <> '{}'::jsonb
    then raise exception 'Invalid verifier envelope'; end if;
  command := (request->>'commandId')::uuid; receipt := (request->>'receiptId')::uuid;
  certificate := (request->>'certificationId')::uuid;
  if command is null or receipt is null then raise exception 'Verifier identities required'; end if;
  -- Global journal lock matches Phase 9, serializing concurrent/crash retries.
  select state into strict journal from public.campaign_execution_journal where singleton for update;
  select * into prior from campaign_verifier.evidence where command_id=command;
  if found then
    if prior.principal is distinct from session_user or prior.request_digest is distinct from public.campaign_authority_hash(request)
      then raise exception 'Conflicting verifier replay'; end if;
    return prior.result; -- immutable historical result only; never a fresh permit
  end if;
  perform public.campaign_validate_certification_scope(scope);
  if scope->>'provider'='sms' or scope->>'environment'='local' or scope->>'mode'<>'controlled_delivery'
    then raise exception 'Controlled readback required; SMS parked'; end if;
  attempt := journal->'attempts'->(scope->>'deliveryKey'); intent := attempt->'dispatchIntent';
  if attempt is null or intent->'atomicRequest' is null
    or attempt->>'id' is distinct from request->>'attemptId' or intent->>'id' is distinct from request->>'intentId'
    or attempt->>'owner' is distinct from request->>'owner' or attempt->>'version' is distinct from request->>'expectedVersion'
    or attempt->>'state' not in ('claimed','submitted','reconciliation_required')
    then raise exception 'Current verifier attempt fence required'; end if;
  -- Canonical/source locks precede qualification and registry locks.
  perform public.campaign_validate_atomic_recovery(intent->'atomicRequest' || jsonb_build_object(
    'record',journal->'releases'->(scope->>'releaseId'),'auditHash',intent->'approval'->>'auditHash',
    'deliveryKey',scope->>'deliveryKey','authorizationKey',scope->>'authorizationKey','contentHash',scope->>'contentHash'));
  select * into strict qualification from public.campaign_provider_qualifications where run_id=(request->>'runId')::uuid for update;
  select * into strict binding from public.campaign_provider_attempt_bindings where run_id=qualification.run_id;
  select * into strict identity from campaign_verifier.identities where principal=session_user for share;
  select * into strict credential from campaign_verifier.credential_references where reference_id=(scope->>'credentialReferenceId')::uuid for share;
  select * into strict authority from campaign_verifier.authorizations where run_id=qualification.run_id for share;
  if not identity.active or identity.verifier_id::text is distinct from scope->>'verifierId'
    or identity.version::text is distinct from scope->>'verifierVersion'
    or not credential.active or credential.version::text is distinct from scope->>'credentialVersion'
    or credential.provider is distinct from scope->>'provider'
    or credential.account_digest is distinct from public.campaign_authority_hash(scope->'accountId')
    or credential.environment is distinct from scope->>'environment'
    or qualification.scope is distinct from scope or qualification.stage<>'provider_readback'
    or authority.scope_digest is distinct from qualification.scope_digest
    or authority.approval_reference_id is distinct from qualification.approval_reference_id
    or authority.revoked_at is not null
    or binding.attempt_id::text is distinct from attempt->>'id' or binding.intent_id::text is distinct from intent->>'id'
    or binding.owner is distinct from attempt->>'owner' or binding.intent_digest is distinct from public.campaign_authority_hash(intent)
    then raise exception 'Verifier reference or authority drift'; end if;
  if jsonb_typeof(observation) is distinct from 'object'
    or (observation - array['scopeDigest','resourceDigest','evidenceDigest','observedAt','status','spentCents','readbackComplete','noDeliveryProven']) <> '{}'::jsonb
    or observation->>'scopeDigest' is distinct from qualification.scope_digest
    or observation->>'resourceDigest' is distinct from authority.resource_digest
    or coalesce(observation->>'evidenceDigest','') !~ '^[a-f0-9]{64}$'
    or coalesce(observation->>'status','') not in ('accepted','uncertain','confirmed','rejected','unknown')
    or jsonb_typeof(observation->'readbackComplete') is distinct from 'boolean'
    or jsonb_typeof(observation->'noDeliveryProven') is distinct from 'boolean'
    then raise exception 'Exact authenticated readback evidence required'; end if;
  outcome := observation->>'status';
  if outcome='unknown' or (outcome='confirmed' and observation->'readbackComplete'<>'true'::jsonb)
    or (outcome='rejected' and (observation->'noDeliveryProven'<>'true'::jsonb or observation->'readbackComplete'<>'true'::jsonb)) then outcome:='uncertain'; end if;
  if (outcome='confirmed') is distinct from (certificate is not null) then raise exception 'Exact certificate identity required for confirmation only'; end if;
  observed := (observation->>'observedAt')::timestamptz;
  -- Repeat after every potential lock wait, including registry rotation/revocation.
  perform public.campaign_validate_atomic_recovery(intent->'atomicRequest' || jsonb_build_object(
    'record',journal->'releases'->(scope->>'releaseId'),'auditHash',intent->'approval'->>'auditHash',
    'deliveryKey',scope->>'deliveryKey','authorizationKey',scope->>'authorizationKey','contentHash',scope->>'contentHash'));
  checked := clock_timestamp();
  if not coalesce(isfinite(observed) and observed between authority.not_before and checked
      and observed >= date_trunc('milliseconds',qualification.created_at)
      and checked < authority.expires_at and checked < qualification.expires_at
      and checked < (attempt->>'leaseUntil')::timestamptz,false)
    then raise exception 'Verifier authority expired or observation stale'; end if;
  perform public.campaign_record_provider_qualification(jsonb_build_object(
    'receiptId',receipt,'runId',qualification.run_id,'scopeDigest',qualification.scope_digest,
    'verifierId',identity.verifier_id,'verifierVersion',identity.version,'outcome',outcome,
    'spentCents',observation->'spentCents','evidenceDigest',observation->>'evidenceDigest',
    'resourceDigest',authority.resource_digest,'observedAt',observation->>'observedAt',
    'readbackComplete',observation->'readbackComplete','noDeliveryProven',observation->'noDeliveryProven'));
  if outcome='confirmed' then
    certificate_expiry := least(authority.expires_at,qualification.expires_at,(attempt->>'leaseUntil')::timestamptz);
    perform public.campaign_issue_provider_certification(jsonb_build_object(
      'certificationId',certificate,'runId',qualification.run_id,'expiresAt',certificate_expiry));
  end if;
  result := public.campaign_adopt_provider_receipt((request - 'observation') || jsonb_build_object('certificationId',certificate));
  -- Return only a privacy-safe inspection projection, not raw provider/account data.
  result := jsonb_build_object('protocol','campaign-provider-verifier/v1','commandId',command,
    'runId',qualification.run_id,'receiptId',receipt,'certificationId',certificate,
    'scopeDigest',qualification.scope_digest,'resourceDigest',authority.resource_digest,
    'outcome',result->>'outcome','completionRecorded',result->'completionRecorded',
    'campaignReservedCents',result->'campaignReservedCents','campaignSpentCents',result->'campaignSpentCents',
    'attemptId',attempt->>'id','attemptVersion',result->'attempt'->'version',
    'providerEnabled',false,'dispatched',false,'dispatchEligible',false);
  insert into campaign_verifier.evidence(command_id,run_id,principal,request_digest,receipt_id,result)
    values(command,qualification.run_id,session_user,public.campaign_authority_hash(request),receipt,result);
  return result;
end $$;
revoke all on function campaign_verifier.ingest(jsonb) from public, anon, authenticated, service_role;
-- Owner-only inspection; grants to a later operator reader require separate review.
create view campaign_verifier.inspection with (security_invoker=true) as
select e.command_id,e.run_id,e.receipt_id,e.created_at,e.result,
  a.expires_at,a.revoked_at, q.state,q.reserved_cents as qualification_reserved_cents,
  q.spent_cents as qualification_spent_cents,
  b.effective_reserved_cents,b.effective_spent_cents
from campaign_verifier.evidence e join campaign_verifier.authorizations a using(run_id)
join public.campaign_provider_qualifications q using(run_id)
join public.campaign_provider_budget_reconciliation b using(run_id);
revoke all on campaign_verifier.inspection from public, anon, authenticated, service_role;
-- Existing qualification inspections/dependency checks must not treat a rotated
-- or revoked bridge credential/verifier/resource grant as current certification.
create function campaign_verifier.is_current(run uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare q public.campaign_provider_qualifications; e campaign_verifier.evidence;
  a campaign_verifier.authorizations; i campaign_verifier.identities;
  c campaign_verifier.credential_references; checked timestamptz;
begin
  select * into e from campaign_verifier.evidence where run_id=run order by created_at desc limit 1;
  if not found then return false; end if;
  select * into strict q from public.campaign_provider_qualifications where run_id=run;
  select * into i from campaign_verifier.identities where principal=e.principal for share;
  select * into c from campaign_verifier.credential_references where reference_id=(q.scope->>'credentialReferenceId')::uuid for share;
  select * into a from campaign_verifier.authorizations where run_id=run for share;
  checked := clock_timestamp();
  return coalesce(i.active and i.verifier_id::text=q.scope->>'verifierId' and i.version::text=q.scope->>'verifierVersion'
    and c.active and c.version::text=q.scope->>'credentialVersion' and c.provider=q.scope->>'provider'
    and c.environment=q.scope->>'environment' and c.account_digest=public.campaign_authority_hash(q.scope->'accountId')
    and a.revoked_at is null and checked>=a.not_before and checked<a.expires_at
    and a.scope_digest=q.scope_digest and a.approval_reference_id=q.approval_reference_id
    and a.resource_digest=e.result->>'resourceDigest',false);
end $$;
revoke all on function campaign_verifier.is_current(uuid) from public, anon, authenticated, service_role;

alter function public.campaign_provider_dependency_confirmed(jsonb) rename to campaign_provider_dependency_confirmed_v9;
create function public.campaign_provider_dependency_confirmed(attempt jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare run uuid;
begin
  if not public.campaign_provider_dependency_confirmed_v9(attempt) then return false; end if;
  select a.run_id into run from public.campaign_provider_adoptions a
    where a.result->'attempt'->>'id'=attempt->>'id' and a.result->>'outcome'='confirmed';
  return campaign_verifier.is_current(run);
end $$;
revoke all on function public.campaign_provider_dependency_confirmed(jsonb),
  public.campaign_provider_dependency_confirmed_v9(jsonb) from public, anon, authenticated, service_role;

alter function public.campaign_inspect_provider_certification(jsonb) rename to campaign_inspect_provider_certification_v8;
create function public.campaign_inspect_provider_certification(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; run uuid;
begin
  result := public.campaign_inspect_provider_certification_v8(request);
  if result->'certificationReady'='true'::jsonb then
    select run_id into run from public.campaign_provider_certifications where certification_id=(result->>'certificationId')::uuid;
    if not campaign_verifier.is_current(run) then
      result := result || jsonb_build_object('certificationReady',false,'blocker','verifier_authority_requires_reconciliation',
        'nextAction','Reconcile current verifier, credential reference and resource authorization.');
    end if;
  end if;
  return result;
end $$;
revoke all on function public.campaign_inspect_provider_certification_v8(jsonb),
  public.campaign_inspect_provider_certification(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.campaign_inspect_provider_certification(jsonb) to service_role;
commit;
