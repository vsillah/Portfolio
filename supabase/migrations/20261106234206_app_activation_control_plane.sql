-- Source-only activation foundation. No client Data API access is granted.
-- Operator review, interest intake, and delivery endpoints are deferred to Phase 2.
create table public.activation_apps (
  app_key text primary key check (app_key ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.activation_interests (
  id uuid primary key default gen_random_uuid(),
  app_key text not null references public.activation_apps(app_key),
  adult_email text not null check (adult_email = lower(btrim(adult_email)) and adult_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'approved', 'waitlisted', 'rejected')),
  source_type text not null check (length(btrim(source_type)) between 1 and 80),
  source_ref text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text,
  unique (id, app_key)
);
create index activation_interests_app_status_idx on public.activation_interests(app_key, status, created_at desc);
create index activation_interests_email_idx on public.activation_interests(app_key, adult_email);

-- Consent evidence is adult/contact specific and append-only by application contract.
-- No child name, age, profile, or other child identity belongs here.
create table public.activation_consents (
  id uuid primary key default gen_random_uuid(),
  interest_id uuid not null,
  app_key text not null,
  consent_kind text not null check (consent_kind in ('interest_contact', 'tester_terms', 'privacy_notice')),
  document_version text not null check (length(btrim(document_version)) between 1 and 80),
  decision text not null check (decision in ('granted', 'withdrawn')),
  recorded_at timestamptz not null default now(),
  source_type text not null check (length(btrim(source_type)) between 1 and 80),
  source_ref text,
  foreign key (interest_id, app_key) references public.activation_interests(id, app_key)
);
create index activation_consents_interest_idx on public.activation_consents(interest_id, consent_kind, recorded_at desc);

create table public.activation_invitations (
  id uuid primary key default gen_random_uuid(),
  interest_id uuid not null,
  app_key text not null,
  status text not null default 'issued' check (status in ('issued', 'redeemed', 'expired', 'revoked')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  foreign key (interest_id, app_key) references public.activation_interests(id, app_key),
  unique (id, app_key, interest_id),
  check (expires_at > issued_at),
  check ((status = 'redeemed') = (redeemed_at is not null and redeemed_by is not null)),
  check ((status = 'revoked') = (revoked_at is not null)),
  check (redeemed_at is null or revoked_at is null)
);
create index activation_invitations_interest_idx on public.activation_invitations(interest_id, status, expires_at);
create index activation_invitations_app_status_idx on public.activation_invitations(app_key, status, expires_at);

create table public.activation_grants (
  id uuid primary key default gen_random_uuid(),
  app_key text not null,
  interest_id uuid not null,
  invitation_id uuid not null unique,
  auth_user_id uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revoke_reason text,
  foreign key (invitation_id, app_key, interest_id) references public.activation_invitations(id, app_key, interest_id),
  unique (id, app_key),
  check (expires_at is null or expires_at > granted_at),
  check ((revoked_at is null) = (revoked_by is null))
);
create index activation_grants_user_app_idx on public.activation_grants(auth_user_id, app_key, revoked_at, expires_at);
create index activation_grants_app_idx on public.activation_grants(app_key, granted_at desc);
create unique index activation_grants_unrevoked_user_app_idx on public.activation_grants(app_key, auth_user_id) where revoked_at is null;

create table public.activation_events (
  id uuid primary key default gen_random_uuid(),
  app_key text not null references public.activation_apps(app_key),
  interest_id uuid,
  invitation_id uuid,
  grant_id uuid,
  event_type text not null check (event_type in ('interest_submitted', 'review_started', 'interest_approved', 'interest_waitlisted', 'interest_rejected', 'consent_recorded', 'invitation_issued', 'invitation_redeemed', 'invitation_expired', 'invitation_revoked', 'grant_created', 'grant_expired', 'grant_revoked')),
  actor_user_id uuid references auth.users(id),
  source_type text not null check (length(btrim(source_type)) between 1 and 80),
  source_ref text,
  occurred_at timestamptz not null default now(),
  foreign key (interest_id, app_key) references public.activation_interests(id, app_key),
  foreign key (invitation_id, app_key, interest_id) references public.activation_invitations(id, app_key, interest_id),
  foreign key (grant_id, app_key) references public.activation_grants(id, app_key),
  check (invitation_id is null or interest_id is not null)
);
create index activation_events_app_time_idx on public.activation_events(app_key, occurred_at desc);
create index activation_events_interest_time_idx on public.activation_events(interest_id, occurred_at desc);

alter table public.activation_apps enable row level security;
alter table public.activation_interests enable row level security;
alter table public.activation_consents enable row level security;
alter table public.activation_invitations enable row level security;
alter table public.activation_grants enable row level security;
alter table public.activation_events enable row level security;

-- Both grants and RLS fail closed. No anon or authenticated policies exist.
revoke all on public.activation_apps, public.activation_interests, public.activation_consents,
  public.activation_invitations, public.activation_grants, public.activation_events
  from public, anon, authenticated;
grant select, insert, update, delete on public.activation_apps, public.activation_interests,
  public.activation_consents, public.activation_invitations, public.activation_grants,
  public.activation_events to service_role;

comment on table public.activation_interests is 'Adult contact interest only; never store child identity or use as outreach authority without current consent evidence.';
comment on column public.activation_invitations.token_hash is 'SHA-256 hex digest of a cryptographically random one-time token. Raw token is never persisted or returned in read models.';
comment on table public.activation_events is 'Append-only activation audit ledger by application contract; no bearer tokens or child PII.';

-- Only a trusted server can call this non-exposed function. The conditional UPDATE
-- claims an invitation once; competing transactions see zero rows after the first.
create schema if not exists activation_private;
revoke all on schema activation_private from public, anon, authenticated;
grant usage on schema activation_private to service_role;

-- The invoker must verify the supplied account ID against Auth's canonical email.
-- service_role already has auth-schema usage, but not table SELECT in current
-- Supabase projects. Grant only the two columns this private check reads.
-- No anon/authenticated Auth-table or activation-table access is added.
grant select (id, email) on auth.users to service_role;

create function activation_private.redeem_invitation(
  p_app_key text,
  p_token_hash text,
  p_auth_user_id uuid,
  p_grant_expires_at timestamptz
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invitation public.activation_invitations%rowtype;
  v_grant_id uuid;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$'
     or p_grant_expires_at is null
     or p_grant_expires_at <= now()
     or p_grant_expires_at > now() + interval '90 days' then
    return null;
  end if;

  update public.activation_invitations i
  set status = 'redeemed', redeemed_at = now(), redeemed_by = p_auth_user_id
  from public.activation_interests r, auth.users u
  where i.app_key = p_app_key
    and i.token_hash = p_token_hash
    and i.status = 'issued'
    and i.redeemed_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and r.id = i.interest_id and r.app_key = i.app_key
    and r.status = 'approved'
    and u.id = p_auth_user_id
    and lower(u.email) = r.adult_email
    and (
      select c.decision
      from public.activation_consents c
      where c.interest_id = r.id and c.app_key = r.app_key
        and c.consent_kind = 'interest_contact'
      order by c.recorded_at desc, c.id desc
      limit 1
    ) = 'granted'
  returning i.* into v_invitation;

  if not found then return null; end if;

  insert into public.activation_grants(app_key, interest_id, invitation_id, auth_user_id, expires_at)
  values (v_invitation.app_key, v_invitation.interest_id, v_invitation.id, p_auth_user_id, p_grant_expires_at)
  returning id into v_grant_id;

  insert into public.activation_events(app_key, interest_id, invitation_id, grant_id, event_type, actor_user_id, source_type)
  values
    (v_invitation.app_key, v_invitation.interest_id, v_invitation.id, v_grant_id, 'invitation_redeemed', p_auth_user_id, 'activation_redeem'),
    (v_invitation.app_key, v_invitation.interest_id, v_invitation.id, v_grant_id, 'grant_created', p_auth_user_id, 'activation_redeem');
  return v_grant_id;
end;
$$;
revoke all on function activation_private.redeem_invitation(text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function activation_private.redeem_invitation(text, text, uuid, timestamptz) to service_role;
