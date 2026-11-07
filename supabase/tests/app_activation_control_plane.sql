-- Run with psql -v ON_ERROR_STOP=1 against an isolated local Supabase database.
-- All fixture rows disappear at ROLLBACK. No hosted database is a valid target.
begin;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['activation_apps', 'activation_interests', 'activation_consents',
    'activation_invitations', 'activation_grants', 'activation_events'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relrowsecurity
    ) then raise exception 'RLS missing on %', v_table; end if;
    if has_table_privilege('anon', 'public.' || v_table, 'SELECT')
       or has_table_privilege('authenticated', 'public.' || v_table, 'SELECT') then
      raise exception 'client SELECT grant on %', v_table;
    end if;
  end loop;
end $$;

set local role anon;
do $$
declare v_table text;
begin
  foreach v_table in array array['activation_apps', 'activation_interests', 'activation_consents',
    'activation_invitations', 'activation_grants', 'activation_events'] loop
    begin
      execute format('select count(*) from public.%I', v_table);
      raise exception 'anon read succeeded on %', v_table;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;

set local role authenticated;
do $$
declare v_table text;
begin
  foreach v_table in array array['activation_apps', 'activation_interests', 'activation_consents',
    'activation_invitations', 'activation_grants', 'activation_events'] loop
    begin
      execute format('select count(*) from public.%I', v_table);
      raise exception 'authenticated read succeeded on %', v_table;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;

insert into auth.users(id, email, aud, role)
values
  ('f0000000-0000-4000-8000-000000000001', 'adult-a@activation.invalid', 'authenticated', 'authenticated'),
  ('f0000000-0000-4000-8000-000000000002', 'adult-b@activation.invalid', 'authenticated', 'authenticated');

insert into public.activation_apps(app_key, display_name)
values ('activation-qa-a', 'QA A'), ('activation-qa-b', 'QA B');

insert into public.activation_interests(id, app_key, adult_email, status, source_type)
values
  ('f1000000-0000-4000-8000-000000000001', 'activation-qa-a', 'adult-a@activation.invalid', 'approved', 'local_sql_qa'),
  ('f1000000-0000-4000-8000-000000000002', 'activation-qa-a', 'adult-a@activation.invalid', 'approved', 'local_sql_qa'),
  ('f1000000-0000-4000-8000-000000000003', 'activation-qa-a', 'adult-a@activation.invalid', 'approved', 'local_sql_qa'),
  ('f1000000-0000-4000-8000-000000000004', 'activation-qa-a', 'adult-a@activation.invalid', 'approved', 'local_sql_qa');

insert into public.activation_consents(interest_id, app_key, consent_kind, document_version, decision, recorded_at, source_type)
select id, app_key, 'interest_contact', 'qa-v1', 'granted', now() - interval '1 hour', 'local_sql_qa'
from public.activation_interests where app_key = 'activation-qa-a';
insert into public.activation_consents(interest_id, app_key, consent_kind, document_version, decision, source_type)
values ('f1000000-0000-4000-8000-000000000002', 'activation-qa-a', 'interest_contact', 'qa-v1', 'withdrawn', 'local_sql_qa');

insert into public.activation_invitations(id, interest_id, app_key, token_hash, issued_at, expires_at, status, revoked_at)
values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'activation-qa-a', encode(sha256(convert_to('qa-valid', 'UTF8')), 'hex'), now(), now() + interval '1 day', 'issued', null),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000002', 'activation-qa-a', encode(sha256(convert_to('qa-withdrawn', 'UTF8')), 'hex'), now(), now() + interval '1 day', 'issued', null),
  ('f2000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000003', 'activation-qa-a', encode(sha256(convert_to('qa-expired', 'UTF8')), 'hex'), now() - interval '2 days', now() - interval '1 day', 'issued', null),
  ('f2000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000004', 'activation-qa-a', encode(sha256(convert_to('qa-revoked', 'UTF8')), 'hex'), now(), now() + interval '1 day', 'revoked', now());

set local role service_role;
do $$
declare
  v_grant uuid;
  v_hash text := encode(sha256(convert_to('qa-valid', 'UTF8')), 'hex');
  v_user uuid := 'f0000000-0000-4000-8000-000000000001';
  v_other uuid := 'f0000000-0000-4000-8000-000000000002';
begin
  if activation_private.redeem_invitation('activation-qa-b', v_hash, v_user, now() + interval '30 days') is not null then
    raise exception 'wrong app redeemed';
  end if;
  if activation_private.redeem_invitation('activation-qa-a', v_hash, v_other, now() + interval '30 days') is not null then
    raise exception 'mismatched adult email redeemed';
  end if;
  if activation_private.redeem_invitation('activation-qa-a', encode(sha256(convert_to('qa-withdrawn', 'UTF8')), 'hex'), v_user, now() + interval '30 days') is not null then
    raise exception 'withdrawn consent redeemed';
  end if;
  if activation_private.redeem_invitation('activation-qa-a', encode(sha256(convert_to('qa-expired', 'UTF8')), 'hex'), v_user, now() + interval '30 days') is not null then
    raise exception 'expired invitation redeemed';
  end if;
  if activation_private.redeem_invitation('activation-qa-a', encode(sha256(convert_to('qa-revoked', 'UTF8')), 'hex'), v_user, now() + interval '30 days') is not null then
    raise exception 'revoked invitation redeemed';
  end if;

  v_grant := activation_private.redeem_invitation('activation-qa-a', v_hash, v_user, now() + interval '30 days');
  if v_grant is null then raise exception 'valid redemption failed'; end if;
  if activation_private.redeem_invitation('activation-qa-a', v_hash, v_user, now() + interval '30 days') is not null then
    raise exception 'second use redeemed';
  end if;
  if (select count(*) from public.activation_grants where app_key = 'activation-qa-a' and auth_user_id = v_user and id = v_grant) <> 1
     or (select count(*) from public.activation_grants where app_key = 'activation-qa-b') <> 0 then
    raise exception 'grant is not unique and app scoped';
  end if;
  if (select count(*) from public.activation_events where grant_id = v_grant and event_type in ('invitation_redeemed', 'grant_created')) <> 2 then
    raise exception 'redemption audit events missing';
  end if;
end $$;
reset role;

rollback;
