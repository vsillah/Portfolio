// @vitest-environment node
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { generateVerifierProvisioning, type VerifierProvisioningInput } from './campaign-verifier-provisioning'
const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12,'0')}`
const fixture = (): VerifierProvisioningInput => ({protocol:'campaign-verifier-provisioning/v1',commandId:id(1),
  targetId:id(4),databaseName:'campaign_phase11_test',identity:{principal:'campaign_v_synthetic',verifierId:id(2),version:1},
  credential:{referenceId:id(3),version:1,provider:'linkedin',environment:'staging',accountDigest:'a'.repeat(64),brokerEntryDigest:'b'.repeat(64)},
  expectedIdentityVersion:0,expectedCredentialVersion:0,expiresAt:'2099-01-01T00:00:00Z'})

describe('metadata-only provisioning contract',()=>{
  it('defaults inactive, deterministic and generation only',()=>{
    const p=generateVerifierProvisioning(fixture())
    expect(generateVerifierProvisioning({...fixture(),commandId:id(1)})).toEqual(p)
    expect(p).toMatchObject({mode:'generate-only',providerEnabled:false,credentialReads:0,externalRequests:0})
    expect(p.sql).toContain("1,false)");expect(p.sql).not.toMatch(/CREATE ROLE|PASSWORD|GRANT USAGE/i)
  })
  it.each(['token','password','resolverPath','providerResponse','recipients','body','active'])('rejects unknown %s without echoing values',key=>{
    expect(()=>generateVerifierProvisioning({...fixture(),[key]:'PRIVATE_CANARY'})).toThrow('Invalid verifier metadata packet')
    expect(()=>generateVerifierProvisioning({...fixture(),credential:{...fixture().credential,[key]:'PRIVATE_CANARY'}})).toThrow('Invalid verifier metadata packet')
  })
  it('rejects API identities, resolver paths, SMS and invalid lifecycle versions',()=>{
    for(const principal of ['postgres','service_role','authenticator',"campaign_v_x';drop table x;--"]) {
      expect(()=>generateVerifierProvisioning({...fixture(),identity:{...fixture().identity,principal}})).toThrow()
    }
    expect(()=>generateVerifierProvisioning({...fixture(),credential:{...fixture().credential,provider:'sms'}})).toThrow()
    expect(()=>generateVerifierProvisioning({...fixture(),credential:{...fixture().credential,brokerEntryDigest:'op://private'}})).toThrow()
    expect(()=>generateVerifierProvisioning({...fixture(),operation:'rotate'})).toThrow()
  })
  it('broker command has no apply path, secret reads or provider egress',()=>{
    const source=readFileSync('lib/campaign-verifier-provisioning.ts','utf8')
    expect(source).not.toMatch(/process\.env|readFile|fetch\(|spawn|from ['"](?:pg|dotenv|.*credential-broker)/)
    const directory=mkdtempSync('/private/tmp/verifier-cli-guard-')
    const guard=directory+'/guard.cjs'
    writeFileSync(guard, `
const fs=require('node:fs'); const original=fs.readFileSync;
fs.readFileSync=function(p,...args){if(typeof p==='string' && /(?:^|\\/)\\.env|credential-inventory|credential-rotation-audits/.test(p)) throw Error('Forbidden credential read');return original.call(this,p,...args)};
global.fetch=()=>{throw Error('Forbidden network')};
for(const mod of ['http','https'])for(const fn of ['request','get'])require(mod)[fn]=()=>{throw Error('Forbidden network')};
require('net').Socket.prototype.connect=function(){throw Error('Forbidden socket')};
for(const fn of ['spawn','spawnSync','exec','execSync','execFile','execFileSync'])require('child_process')[fn]=()=>{throw Error('Forbidden resolver process')};
`)
    const env={NODE_ENV:'test' as const,PATH:process.env.PATH,HOME:'/private/tmp',CREDENTIAL_BROKER_SKIP_DOTENV:'1'}
    const run=(args:string[],input:string)=>spawnSync(process.execPath,['--require',guard,'--import','tsx','scripts/credential-broker.ts','verifier-provision',...args],{input,encoding:'utf8',env})
    const generated=run([],JSON.stringify(fixture()))
    expect(generated.status).toBe(0);expect(JSON.parse(generated.stdout)).toEqual(generateVerifierProvisioning(fixture()))
    expect(run(['--apply'],JSON.stringify(fixture())).status).toBe(1)
    expect(run(['PRIVATE_CANARY'],JSON.stringify(fixture())).stderr).not.toContain('PRIVATE_CANARY')
    const invalid=run([],JSON.stringify({...fixture(),token:'PRIVATE_CANARY'}))
    expect(invalid.status).toBe(1);expect(invalid.stdout+invalid.stderr).not.toContain('PRIVATE_CANARY')
    rmSync(directory,{recursive:true,force:true})
  })
})

const url=process.env.CAMPAIGN_PROVISIONING_TEST_URL
describe.skipIf(!url)('real PostgreSQL provisioning lifecycle',()=>{
  let admin:Client,verifier:Client,api:Client
  let seq=10
  const packet=(operation:VerifierProvisioningInput['operation'],version=1)=>generateVerifierProvisioning({...fixture(),commandId:id(seq++),operation,
    identity:{...fixture().identity,version},credential:{...fixture().credential,version},
    expectedIdentityVersion:operation==='provision'?0:operation==='rotate'?version-1:version,
    expectedCredentialVersion:operation==='provision'?0:operation==='rotate'?version-1:version})
  const apply=async(p:ReturnType<typeof packet>,authorize=true,client=admin)=>{
    await client.query('begin')
    try {
      if(authorize)await client.query("select set_config('campaign.provisioning_authorization',$1,true)",[p.packetDigest])
      await client.query(p.sql);await client.query('commit')
    }catch(e){await client.query('rollback');throw e}
  }
  const state=async()=>({
    identities:(await admin.query('select * from campaign_verifier.identities')).rows,
    references:(await admin.query('select * from campaign_verifier.credential_references')).rows,
    events:(await admin.query('select * from campaign_verifier.provisioning_events order by command_id')).rows,
    journal:(await admin.query('select * from campaign_execution_journal')).rows,
    authority:(await admin.query('select * from campaign_verifier.authorizations')).rows,
    evidence:(await admin.query('select * from campaign_verifier.evidence')).rows,
  })
  beforeAll(async()=>{
    if(!url||new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/campaign_phase11_test')throw Error('Disposable database only')
    admin=new Client({connectionString:url});await admin.connect()
    await admin.query(`create role anon;create role authenticated;create role service_role bypassrls;
      create role campaign_v_synthetic login password 'local-synthetic-only';create role campaign_v_wrong login;
      create table agent_runs(id uuid primary key,kind text,metadata jsonb);
      create table social_content_queue(id uuid primary key,body text,evidence jsonb,updated_at timestamptz);
      create table outreach_queue(like social_content_queue including all);
      create table video_generation_jobs(like social_content_queue including all);
      create table attraction_campaigns(like social_content_queue including all);
      create table social_content_calendar_items(like social_content_queue including all);
      create table contact_submissions(like social_content_queue including all);`)
    for(const f of ['20261003104423_campaign_execution_journal.sql','20261003130200_campaign_execution_journal_service_role_grants.sql',
      '20261003233618_campaign_atomic_sandbox_authority.sql','20261004001737_campaign_atomic_recovery.sql',
      '20261004005627_campaign_provider_certification.sql','20261004011705_campaign_provider_receipt_adoption.sql',
      '20261004021121_campaign_provider_verifier_bridge.sql','20261004025253_campaign_verifier_provisioning_events.sql'])await admin.query(readFileSync(`supabase/migrations/${f}`,'utf8'))
    await admin.query("insert into campaign_verifier.deployment_target values(true,$1,'campaign_phase11_test','staging')",[id(4)])
    verifier=new Client({connectionString:url.replace('postgres:local-synthetic-only@','campaign_v_synthetic:local-synthetic-only@')});await verifier.connect()
    api=new Client({connectionString:url});await api.connect();await api.query('set role service_role')
  })
  afterAll(async()=>{await Promise.all([admin?.end(),verifier?.end(),api?.end()])})
  it('requires separate authorization and defaults inactive with no grants',async()=>{
    const p=packet('provision');const before=await state()
    await expect(apply(p,false)).rejects.toThrow('Separate action-time');expect(await state()).toEqual(before)
    await admin.query("update campaign_verifier.deployment_target set environment='production'")
    await expect(apply(p)).rejects.toThrow('staging target pin')
    await admin.query("update campaign_verifier.deployment_target set environment='staging'")
    await apply(p);expect((await state()).identities[0].active).toBe(false)
    await expect(verifier.query("select campaign_verifier.ingest('{}')")).rejects.toThrow('permission denied')
    const after=await state();await apply(p);expect(await state()).toEqual(after)
    await expect(apply(generateVerifierProvisioning({...p.projection,expiresAt:'2098-01-01T00:00:00Z'}))).rejects.toThrow('Conflicting')
  })
  it('binds exact database, environment, account, broker, identity and version',async()=>{
    const good=packet('activate')
    for(const patch of [{targetId:id(999)},{databaseName:'other_db'},{credential:{...good.projection.credential,environment:'production'}},
      {credential:{...good.projection.credential,accountDigest:'c'.repeat(64)}},
      {credential:{...good.projection.credential,brokerEntryDigest:'c'.repeat(64)}},
      {identity:{...good.projection.identity,principal:'campaign_v_wrong'}},
      {identity:{...good.projection.identity,version:2},expectedIdentityVersion:2}]) {
      const before=await state();await expect(apply(generateVerifierProvisioning({...good.projection,...patch}))).rejects.toThrow();expect(await state()).toEqual(before)
    }
    await expect(apply(generateVerifierProvisioning({...good.projection,expiresAt:'2000-01-01T00:00:00Z'}))).rejects.toThrow('expired')
  })
  it('activates only USAGE/ingest, authenticates session_user and denies API or registry writes',async()=>{
    await apply(packet('activate'))
    expect((await verifier.query('select session_user')).rows[0].session_user).toBe('campaign_v_synthetic')
    await expect(verifier.query("select campaign_verifier.ingest('{}')")).rejects.toThrow('Verifier identities required')
    await expect(verifier.query('update campaign_verifier.identities set active=true')).rejects.toThrow('permission denied')
    await expect(verifier.query("select campaign_prepare_provider_qualification('{}')")).rejects.toThrow('permission denied')
    await expect(api.query("select campaign_verifier.ingest('{}')")).rejects.toThrow('permission denied')
    await expect(apply(packet('revoke'),true,api)).rejects.toThrow('permission denied')
  })
  it('rotation and revocation disable projections, preserve evidence/accounting and cannot be replayed into activation',async()=>{
    const active=packet('activate');await apply(active)
    const baseline=await state()
    await apply(packet('rotate',2))
    expect((await state()).identities[0]).toMatchObject({active:false,version:'2'})
    await expect(verifier.query("select campaign_verifier.ingest('{}')")).rejects.toThrow('permission denied')
    await apply(active);expect((await state()).identities[0].active).toBe(false)
    await apply(packet('activate',2));const revoked=packet('revoke',2);await apply(revoked)
    await expect(apply(packet('activate',2))).rejects.toThrow('Revoked version')
    await apply(revoked)
    const after=await state();expect(after.journal).toEqual(baseline.journal);expect(after.evidence).toEqual(baseline.evidence)
    await expect(admin.query('delete from campaign_verifier.provisioning_events')).rejects.toThrow()
  })
  it('rolls back projection and grant changes if the append-only audit cannot be recorded',async()=>{
    const before=await state()
    await admin.query(`create function campaign_verifier.reject_test_event() returns trigger language plpgsql as $$begin raise exception 'Synthetic append failure'; end$$;
      create trigger reject_test_event before insert on campaign_verifier.provisioning_events for each row execute function campaign_verifier.reject_test_event();
      revoke all on function campaign_verifier.reject_test_event() from public;`)
    try{await expect(apply(packet('rotate',3))).rejects.toThrow('Synthetic append failure');expect(await state()).toEqual(before)}
    finally{await admin.query('drop trigger reject_test_event on campaign_verifier.provisioning_events;drop function campaign_verifier.reject_test_event()')}
  })
  it('refuses role membership and excess table/function privileges',async()=>{
    const p=packet('rotate',3)
    await admin.query('grant service_role to campaign_v_synthetic')
    await expect(apply(p)).rejects.toThrow('Isolated');await admin.query('revoke service_role from campaign_v_synthetic')
    await admin.query('grant select on campaign_verifier.identities to campaign_v_synthetic')
    await expect(apply(p)).rejects.toThrow('excess');await admin.query('revoke select on campaign_verifier.identities from campaign_v_synthetic')
    await admin.query('grant update(active) on campaign_verifier.identities to campaign_v_synthetic')
    await expect(apply(p)).rejects.toThrow('excess');await admin.query('revoke update(active) on campaign_verifier.identities from campaign_v_synthetic')
    await admin.query('grant execute on function campaign_verifier.ingest(jsonb) to campaign_v_synthetic with grant option')
    await expect(apply(p)).rejects.toThrow('excess');await admin.query('revoke all on function campaign_verifier.ingest(jsonb) from campaign_v_synthetic')
    await admin.query('grant execute on function campaign_prepare_provider_qualification(jsonb) to campaign_v_synthetic')
    await expect(apply(p)).rejects.toThrow('excess');await apply(packet('revoke',2));await admin.query('revoke execute on function campaign_prepare_provider_qualification(jsonb) from campaign_v_synthetic')
  })
})
