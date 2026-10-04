begin;
-- Metadata audit only. No identities, credentials, roles, grants or activation seeded.
-- Empty owner-managed target pin. Database names alone are not environment identity.
create table campaign_verifier.deployment_target (
  singleton boolean primary key default true check(singleton),
  target_id uuid not null unique,
  database_name name not null,
  environment text not null check(environment in ('staging','production'))
);
alter table campaign_verifier.deployment_target enable row level security;
revoke all on campaign_verifier.deployment_target from public, anon, authenticated, service_role;
create table campaign_verifier.provisioning_events (
  command_id uuid primary key,
  packet_digest text not null check(packet_digest ~ '^[a-f0-9]{64}$'),
  broker_entry_digest text not null check(broker_entry_digest ~ '^[a-f0-9]{64}$'),
  operation text not null check(operation in ('provision','activate','rotate','revoke')),
  verifier_id uuid not null,
  reference_id uuid not null,
  identity_version bigint not null check(identity_version > 0),
  credential_version bigint not null check(credential_version > 0),
  created_at timestamptz not null default clock_timestamp()
);
alter table campaign_verifier.provisioning_events enable row level security;
revoke all on campaign_verifier.provisioning_events from public, anon, authenticated, service_role;
create trigger campaign_verifier_provisioning_immutable before update or delete on campaign_verifier.provisioning_events
  for each row execute function public.campaign_preserve_provider_evidence();
commit;
