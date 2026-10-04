// @vitest-environment node
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { generateVerifierProvisioning, type VerifierProvisioningInput } from './campaign-verifier-provisioning'

const url = process.env.CAMPAIGN_CREATOR_ADMIN_TEST_URL
const id = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12,'0')}`
describe.skipIf(!url)('real PostgreSQL creator-admin isolation', () => {
  let admin: Client, owner: Client
  let seq = 10
  const packet = (principal: string, overrides: Partial<VerifierProvisioningInput> = {}) => generateVerifierProvisioning({
    protocol:'campaign-verifier-provisioning/v1',commandId:id(seq++),targetId:id(1),databaseName:'campaign_creator_admin_test',
    identity:{principal,verifierId:id(seq++),version:1},
    credential:{referenceId:id(seq++),version:1,provider:'linkedin',environment:'staging',accountDigest:'a'.repeat(64),brokerEntryDigest:'b'.repeat(64)},
    expectedIdentityVersion:0,expectedCredentialVersion:0,expiresAt:'2099-01-01T00:00:00Z',...overrides,
  })
  const create = async () => {
    const principal = `campaign_v_creator_${seq++}`
    // Actual direct non-superuser creation, not SET ROLE or a fabricated positive fixture.
    await owner.query(`create role ${principal} login password 'local-synthetic-only'`)
    return principal
  }
  const memberships = async (principal: string) => (await admin.query(`
    select r.rolname role, u.rolname member, g.rolname grantor, m.grantor::int grantor_oid,
      m.admin_option, m.inherit_option, m.set_option
    from pg_auth_members m join pg_roles r on r.oid=m.roleid
    join pg_roles u on u.oid=m.member join pg_roles g on g.oid=m.grantor
    where r.rolname=$1 or u.rolname=$1 order by u.rolname, g.rolname`,[principal])).rows
  const state = async () => {
    const result: Record<string, unknown> = {}
    for (const table of ['campaign_verifier.identities','campaign_verifier.credential_references',
      'campaign_verifier.provisioning_events','campaign_verifier.authorizations','campaign_verifier.evidence','public.campaign_execution_journal']) {
      result[table]=(await admin.query(`select to_jsonb(t) row from ${table} t order by to_jsonb(t)::text`)).rows
    }
    return result
  }
  const apply = async (p: ReturnType<typeof packet>, client = owner, authorize = true) => {
    await client.query('begin')
    try {
      if (authorize) await client.query("select set_config('campaign.provisioning_authorization',$1,true)",[p.packetDigest])
      await client.query(p.sql)
      await client.query('commit')
    } catch (e) { await client.query('rollback'); throw e }
  }
  const rejects = async (principal: string, message = 'Isolated') => {
    const before = await state()
    await expect(apply(packet(principal))).rejects.toThrow(message)
    expect(await state()).toEqual(before)
  }
  beforeAll(async () => {
    if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/campaign_creator_admin_test') throw Error('Disposable database only')
    admin = new Client({connectionString:url}); await admin.connect()
    console.log('Creator-admin test server:', (await admin.query('show server_version')).rows[0].server_version)
    await admin.query(`create role anon;create role authenticated;create role service_role bypassrls;
      create role qa_schema_owner login createrole password 'local-synthetic-only';
      create role supabase_admin;create role qa_other_super superuser;
      create role qa_other_creator login createrole password 'local-synthetic-only';
      create table agent_runs(id uuid primary key,kind text,metadata jsonb);
      create table social_content_queue(id uuid primary key,body text,evidence jsonb,updated_at timestamptz);
      create table outreach_queue(like social_content_queue including all);
      create table video_generation_jobs(like social_content_queue including all);
      create table attraction_campaigns(like social_content_queue including all);
      create table social_content_calendar_items(like social_content_queue including all);
      create table contact_submissions(like social_content_queue including all);`)
    for (const f of ['20261003104423_campaign_execution_journal.sql','20261003130200_campaign_execution_journal_service_role_grants.sql',
      '20261003233618_campaign_atomic_sandbox_authority.sql','20261004001737_campaign_atomic_recovery.sql',
      '20261004005627_campaign_provider_certification.sql','20261004011705_campaign_provider_receipt_adoption.sql',
      '20261004021121_campaign_provider_verifier_bridge.sql','20261004025253_campaign_verifier_provisioning_events.sql',
      '20261004100212_campaign_authority_reconciliation.sql']) await admin.query(readFileSync(`supabase/migrations/${f}`,'utf8'))
    await admin.query(`alter schema campaign_verifier owner to qa_schema_owner;
      alter table public.campaign_execution_journal owner to qa_schema_owner;
      alter function campaign_verifier.ingest(jsonb) owner to qa_schema_owner;`)
    for (const table of ['identities','credential_references','authorizations','evidence','deployment_target','provisioning_events']) {
      await admin.query(`alter table campaign_verifier.${table} owner to qa_schema_owner`)
    }
    owner = new Client({connectionString:url.replace('synthetic_bootstrap:','qa_schema_owner:')}); await owner.connect()
    await owner.query("insert into campaign_verifier.deployment_target values(true,$1,'campaign_creator_admin_test','staging')",[id(1)])
    expect((await owner.query('select current_user, session_user, rolsuper, rolcreaterole from pg_roles where rolname=session_user')).rows)
      .toEqual([{current_user:'qa_schema_owner',session_user:'qa_schema_owner',rolsuper:false,rolcreaterole:true}])
  })
  afterAll(async () => { await Promise.all([admin?.end(),owner?.end()]) })

  it('accepts only the actual creator ADMIN edge and leaves provision inactive', async () => {
    const principal = await create()
    const edge = [{role:principal,member:'qa_schema_owner',grantor:'synthetic_bootstrap',grantor_oid:10,
      admin_option:true,inherit_option:false,set_option:false}]
    expect(await memberships(principal)).toEqual(edge)
    // The creator cannot remove the bootstrap grant or impersonate the bootstrap/verifier.
    await owner.query(`revoke ${principal} from qa_schema_owner`)
    expect(await memberships(principal)).toEqual(edge)
    await expect(owner.query('set role synthetic_bootstrap')).rejects.toThrow('permission denied')
    await expect(owner.query(`set role ${principal}`)).rejects.toThrow('permission denied')
    const p = packet(principal); await apply(p)
    expect((await admin.query('select active from campaign_verifier.identities where principal=$1',[principal])).rows).toEqual([{active:false}])
    expect((await admin.query('select active from campaign_verifier.credential_references where reference_id=$1',[p.projection.credential.referenceId])).rows).toEqual([{active:false}])
    expect((await admin.query("select has_schema_privilege($1,'campaign_verifier','USAGE') usage, has_function_privilege($1,'campaign_verifier.ingest(jsonb)','EXECUTE') execute",[principal])).rows).toEqual([{usage:false,execute:false}])
    const after = await state(); await apply(p); expect(await state()).toEqual(after)
    expect(await memberships(principal)).toEqual(edge)
  })
  it('preserves the existing zero-membership LOGIN path', async () => {
    const principal = `campaign_v_zero_${seq++}`; await admin.query(`create role ${principal} login`)
    expect(await memberships(principal)).toEqual([]); await apply(packet(principal))
  })
  it('requires separate activation before a dedicated creator-owned LOGIN can reach ingest', async () => {
    const principal = await create(); const p = packet(principal); await apply(p)
    const verifier = new Client({connectionString:url!.replace('synthetic_bootstrap:',`${principal}:`)})
    await verifier.connect()
    try {
      expect((await verifier.query('select session_user')).rows).toEqual([{session_user:principal}])
      await expect(verifier.query("select campaign_verifier.ingest('{}')")).rejects.toThrow('permission denied')
      const activation = generateVerifierProvisioning({...p.projection,commandId:id(seq++),operation:'activate',
        expectedIdentityVersion:1,expectedCredentialVersion:1})
      await expect(apply(activation,owner,false)).rejects.toThrow('Separate action-time')
      await apply(activation)
      await expect(verifier.query("select campaign_verifier.ingest('{}')")).rejects.toThrow('Verifier identities required')
      await expect(verifier.query('select * from campaign_verifier.identities')).rejects.toThrow('permission denied')
      expect(await memberships(principal)).toHaveLength(1)
    } finally { await verifier.end() }
  })
  it.each([
    ['parent','grant service_role to PRINCIPAL'],
    ['child','grant PRINCIPAL to anon with admin false, inherit false, set false'],
    ['second creator grant','grant PRINCIPAL to qa_schema_owner with admin false, inherit false, set false granted by qa_schema_owner'],
    ['inherit option','grant PRINCIPAL to qa_schema_owner with inherit true'],
    ['set option','grant PRINCIPAL to qa_schema_owner with set true'],
    ['missing admin option','grant PRINCIPAL to qa_schema_owner with admin false'],
  ])('rejects %s with no registry/journal writes', async (_name, sql) => {
    const principal = await create(); await admin.query(sql.replaceAll('PRINCIPAL',principal)); await rejects(principal)
  })
  it.each(['qa_schema_owner','supabase_admin','qa_other_super'])('rejects a sole unsafe grantor %s, including a spoofed platform name', async grantor => {
    const principal = await create()
    // Deliberate catalog corruption only inside this disposable cluster tests the
    // grantor predicate independently of the separate membership-count fence.
    await admin.query(`update pg_auth_members set grantor=(select oid from pg_roles where rolname=$1)
      where roleid=(select oid from pg_roles where rolname=$2)`,[grantor,principal])
    expect(await memberships(principal)).toHaveLength(1); await rejects(principal)
  })
  it('rejects an ADMIN edge to a different creator instead of the schema owner', async () => {
    const other = new Client({connectionString:url!.replace('synthetic_bootstrap:','qa_other_creator:')})
    await other.connect()
    const principal = `campaign_v_other_${seq++}`
    try { await other.query(`create role ${principal} login`) } finally { await other.end() }
    expect(await memberships(principal)).toHaveLength(1); await rejects(principal)
  })
  it.each(['superuser','nocreaterole'])('rejects the exception when the owner becomes %s', async attribute => {
    const principal = await create()
    await admin.query(`alter role qa_schema_owner ${attribute}`)
    try { await rejects(principal) } finally { await admin.query('alter role qa_schema_owner nosuperuser createrole') }
  })
  it.each(['select on campaign_verifier.identities','update(active) on campaign_verifier.identities',
    'execute on function campaign_prepare_provider_qualification(jsonb)',
    'execute on function campaign_verifier.ingest(jsonb) with grant option',
    'create on schema campaign_verifier','usage on schema campaign_verifier with grant option'])('still rejects excess %s', async privilege => {
    const principal = await create(); await admin.query(`grant ${privilege.replace(' with grant option','')} to ${principal}${privilege.includes(' with grant option')?' with grant option':''}`)
    await rejects(principal,'excess')
  })
  it('preserves direct-owner, authorization, production and privileged-LOGIN refusals', async () => {
    const principal = await create(); const p = packet(principal)
    const before = await state()
    await expect(apply(p,owner,false)).rejects.toThrow('Separate action-time')
    await admin.query('set role qa_schema_owner')
    try { await expect(apply(p,admin)).rejects.toThrow('Direct schema owner') } finally { await admin.query('reset role') }
    await expect(apply(packet(principal,{credential:{...p.projection.credential,environment:'production'}}))).rejects.toThrow('production refused')
    await admin.query(`alter role ${principal} createdb`); await rejects(principal)
    expect(await state()).toEqual(before)
  })
})
