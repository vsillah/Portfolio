-- Reconcile a skipped Phase 6 after Phases 7-11 have already been installed.
-- Copy only the original canonicalization/key helpers; never replay Phase 6's
-- authorization/commit replacements over the current, stricter function bodies.
-- No rows, provider activation, identity provisioning or credential access.
begin;

create or replace function public.campaign_authority_json(value jsonb) returns text
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
create or replace function public.campaign_authority_hash(value jsonb) returns text
language sql immutable strict security invoker set search_path = '' as $$
  select encode(sha256(convert_to(public.campaign_authority_json(value), 'UTF8')), 'hex');
$$;
create or replace function public.campaign_authority_keys(action jsonb, manifest_hash text) returns jsonb
language sql immutable strict security invoker set search_path = '' as $$
  select jsonb_build_object(
    'contentHash', public.campaign_authority_hash(jsonb_build_object('copy', action->'copy', 'assets', action->'assets')),
    'authorizationKey', 'campaign-authorization:' || public.campaign_authority_hash(jsonb_build_array(manifest_hash, action->>'id')),
    'deliveryKey', 'campaign-action:' || public.campaign_authority_hash(jsonb_build_object(
      'provider', action->'provider', 'accountId', action->'accountId', 'operation', action->'operation',
      'source', jsonb_build_object('table', action->'source'->'table', 'id', action->'source'->'id'),
      'recipients', coalesce((select jsonb_agg(lower(btrim(r->>'address')) order by lower(btrim(r->>'address')) collate "C") from jsonb_array_elements(action->'recipients') r), '[]'::jsonb))));
$$;

-- CREATE OR REPLACE preserves existing ACLs; missing helpers start with PUBLIC
-- EXECUTE. Explicitly narrow both states within this same transaction.
revoke all on function public.campaign_authority_json(jsonb),
  public.campaign_authority_hash(jsonb), public.campaign_authority_keys(jsonb,text)
  from public, anon, authenticated, service_role;

-- Reassert only the intended API role. Do not replace either current body.
revoke all on function public.campaign_authorize_sandbox_intent(jsonb),
  public.campaign_execution_commit(bigint,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.campaign_authorize_sandbox_intent(jsonb),
  public.campaign_execution_commit(bigint,jsonb) to service_role;
commit;
