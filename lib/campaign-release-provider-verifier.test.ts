// @vitest-environment node
import { generateVerifierProvisioning } from './campaign-verifier-provisioning'
import { campaignCertificationScope, type CertificationScope } from './campaign-release-provider-certification'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type AtomicCampaignRequest } from './campaign-release-atomic-authority'
import { approvalIdentity } from './campaign-release-activation'
import { campaignActionKeys, campaignSourceFingerprint, decideCampaignRelease, releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import { emptyExecutionState } from './campaign-release-execution'
import { fixture } from './campaign-release-test-fixture'
vi.mock('server-only', () => ({}))
import { CampaignProviderVerifierBridge, type VerifierRequest } from './campaign-release-provider-verifier'
import { campaignCertificationContracts } from './campaign-release-certification'

const url = process.env.CAMPAIGN_VERIFIER_TEST_URL
const migration = readFileSync('supabase/migrations/20261003233618_campaign_atomic_sandbox_authority.sql', 'utf8')
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`
const stamp = (offset: number) => new Date(Date.now() + offset).toISOString()
function data(provider: CertificationScope['provider'] = 'linkedin') {
  const manifest = fixture()
  if(provider==='sms')throw new Error('SMS parked')
  const action=manifest.actions[0], contract=campaignCertificationContracts[provider]
  action.provider=provider;action.operation=contract.operation as typeof action.operation;action.expectedReceipt=contract.receipt as typeof action.expectedReceipt
  if(provider==='gmail'||provider==='manual_social') {
    manifest.class='relationship_outreach_batch';action.source.table='outreach_queue'
    action.recipients=[{address:'synthetic@example.invalid',consentEvidenceId:'synthetic-consent',suppressionEvidenceId:'synthetic-clear'}]
  } else if(provider==='heygen')action.source.table='video_generation_jobs'
  manifest.createdAt = stamp(-60000); manifest.expiresAt = stamp(3600000)
  manifest.actions[0].scheduledFor = stamp(-30000); manifest.actions[0].evidenceExpiresAt = stamp(3600000)
  manifest.spendCapCents = 100; manifest.actions[0].maxSpendCents = 50
  const source = { id: manifest.actions[0].source.id, body: 'exact evidence', evidence: { consent: 'current', suppression: 'clear' } }
  manifest.actions[0].source.fingerprint = campaignSourceFingerprint(source)
  const pending: ReleaseRecord = { manifest, hash: releaseHash(manifest), state: 'pending', version: 1, audit: [] }
  const record = structuredClone(decideCampaignRelease(pending, pending.hash, 'approve', 'portfolio:synthetic', new Date()))
  const request: AtomicCampaignRequest = { releaseId: manifest.releaseId, hash: record.hash, approvalVersion: 2,
    actionId: manifest.actions[0].id, owner: 'sandbox-worker', journalVersion: 0, requestId: id(9), dependencyDigest: releaseHash({}) }
  return { record, source, request }
}

import type { ExecutionAttempt } from './campaign-release-execution'
describe.skipIf(!url)('real PostgreSQL authenticated verifier bridge', () => {
  let admin: Client, worker: Client, other: Client, verifier: Client
  let x: ReturnType<typeof data>
  async function connect() {
    if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/campaign_phase10_test') throw new Error('Disposable local database only')
    const client = new Client({ connectionString: url }); await client.connect(); return client
  }
  const payload = () => ({ ...x.request, record: x.record, auditHash: releaseHash(x.record.audit), ...campaignActionKeys(x.record.manifest, x.request.actionId) })
  async function call(client = worker, request = payload()) {
    return (await client.query('select public.campaign_authorize_sandbox_intent($1::jsonb) result', [JSON.stringify(request)])).rows[0].result
  }
  async function snapshot() { return (await admin.query('select state from public.campaign_execution_journal')).rows[0].state }
  async function seed() {
    const state = emptyExecutionState()
    state.releases[x.request.releaseId] = x.record
    state.approvalBindings = { [x.request.releaseId]: { ...approvalIdentity(x.record, new Date()), status: 'bound', executionEnabled: false, checkedAt: stamp(0) } }
    await admin.query('update public.campaign_execution_journal set version=0,state=$1', [state])
    await admin.query("insert into public.agent_runs(id,kind,metadata) values($1,'campaign_release_manifest',$2) on conflict(id) do update set metadata=excluded.metadata", [x.request.releaseId, x.record])
    await admin.query(`insert into public.${x.record.manifest.actions[0].source.table}(id,body,evidence) values($1,$2,$3) on conflict(id) do update set body=excluded.body,evidence=excluded.evidence`, [x.source.id,x.source.body,x.source.evidence])
  }
  async function waitForPid(pid: number) {
    const end = Date.now() + 5000
    while (Date.now() < end) {
      const r = await admin.query('select wait_event_type from pg_stat_activity where pid=$1', [pid])
      if (r.rows[0]?.wait_event_type === 'Lock') return
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw new Error('Expected real lock contention was not observed')
  }
  let attempt: ExecutionAttempt
  let sequence = 30
  async function editAttempt(patch: Record<string, unknown>) {
    const state = await snapshot(); Object.assign(state.attempts[attempt.deliveryKey], patch)
    await admin.query('update campaign_execution_journal set state=$1',[state]); attempt = state.attempts[attempt.deliveryKey]
  }
  async function expire() { await editAttempt({leaseUntil:stamp(-1000)}) }
  beforeAll(async () => {
    admin = await connect(); worker = await connect(); other = await connect()
    console.log('Database engine:', (await admin.query('select version()')).rows[0].version)
    await admin.query(`create role anon; create role authenticated; create role service_role bypassrls;
      create table public.agent_runs(id uuid primary key,kind text,metadata jsonb);
      create table public.social_content_queue(id uuid primary key,body text,evidence jsonb,updated_at timestamptz);
      create table public.outreach_queue(like public.social_content_queue including all);
      create table public.video_generation_jobs(like public.social_content_queue including all);
      create table public.attraction_campaigns(like public.social_content_queue including all);
      create table public.social_content_calendar_items(like public.social_content_queue including all);
      create table public.contact_submissions(like public.social_content_queue including all);`)
    for (const name of ['20261003104423_campaign_execution_journal.sql', '20261003130200_campaign_execution_journal_service_role_grants.sql']) await admin.query(readFileSync(`supabase/migrations/${name}`, 'utf8'))
    await admin.query(migration)
    await admin.query("create role synthetic_verifier login password 'local-synthetic-only'; create role unrelated_verifier login password 'local-synthetic-only'");
    await worker.query('set role service_role'); await other.query('set role service_role')
    x=data();await seed();await call();const beforeUpgrade=await snapshot()
    await admin.query(readFileSync('supabase/migrations/20261004001737_campaign_atomic_recovery.sql','utf8'))
    await admin.query(readFileSync('supabase/migrations/20261004005627_campaign_provider_certification.sql','utf8'))
    await admin.query(readFileSync('supabase/migrations/20261004011705_campaign_provider_receipt_adoption.sql','utf8'))
    await admin.query(readFileSync('supabase/migrations/20261004021121_campaign_provider_verifier_bridge.sql','utf8'))
    await admin.query(readFileSync('supabase/migrations/20261004025253_campaign_verifier_provisioning_events.sql','utf8'))
    await admin.query("insert into campaign_verifier.deployment_target values(true,$1,'campaign_phase10_test','staging')",[id(499)])
    await admin.query("create role campaign_v_lifecycle login password 'local-synthetic-only'")
    expect((await admin.query('select count(*)::int n from campaign_verifier.identities')).rows[0].n).toBe(0)
    await admin.query('grant usage on schema campaign_verifier to synthetic_verifier, unrelated_verifier; grant execute on function campaign_verifier.ingest(jsonb) to synthetic_verifier, unrelated_verifier')
    verifier = new Client({connectionString:url!.replace('postgres:local-synthetic-only@','synthetic_verifier:local-synthetic-only@')}); await verifier.connect()
    expect((await verifier.query('select session_user')).rows[0].session_user).toBe('synthetic_verifier')
    expect(await snapshot()).toEqual(beforeUpgrade)
  }, 30000)
  afterAll(async () => { await Promise.all([admin?.end(), worker?.end(), other?.end(), verifier?.end()]) })
  afterEach(async () => { await Promise.all([admin,worker,other,verifier].map(c=>c.query('rollback'))) })
  beforeEach(async () => { x = data(); await seed(); await admin.query('truncate campaign_verifier.evidence,campaign_verifier.authorizations,campaign_verifier.identities,campaign_verifier.credential_references,campaign_provider_adoptions,campaign_provider_resource_claims,campaign_provider_attempt_bindings,campaign_provider_certification_revocations,campaign_provider_certifications,campaign_provider_qualification_receipts,campaign_provider_qualifications; delete from campaign_atomic_recovery_commands'); attempt = (await call()).attempt })

  const scope = (patch: Partial<CertificationScope> = {}) => ({...campaignCertificationScope(x.record,x.request.actionId,{
    environment:'staging',credentialReferenceId:id(401),credentialVersion:1,mode:'controlled_delivery',verifierId:id(402),verifierVersion:1,
  }),...patch})
  const plan = (patch: Record<string,unknown> = {}) => ({runId:id(403),scope:scope(),stage:'provider_readback',approvalReferenceId:id(404),expiresAt:stamp(1800000),...patch})
  const prepare = (p=plan(), client=admin) => client.query('select campaign_prepare_provider_qualification($1) result',[p])
  const issueRequest = () => ({certificationId:id(405),runId:id(403),expiresAt:stamp(600000)})
  async function current() { attempt=(await snapshot()).attempts[attempt.deliveryKey];return attempt }
  const resource = releaseHash('exact-provider-resource')
  async function register() {
    await prepare()
    await admin.query('insert into campaign_verifier.identities values($1,$2,1,true)',['synthetic_verifier',id(402)])
    await admin.query('insert into campaign_verifier.credential_references values($1,1,$2,$3,$4,true)',[id(401),scope().provider,releaseHash(scope().accountId),'staging'])
    await admin.query('insert into campaign_verifier.authorizations values($1,$2,$3,$4,$5,$6,null)',[id(403),releaseHash(scope()),id(404),resource,stamp(-1000),stamp(600000)])
  }
  const envelope = (status='confirmed', patch:Record<string,unknown>={}) => ({
    commandId:id(sequence++),receiptId:id(sequence++),certificationId:status==='confirmed'?id(405):null,
    runId:id(403),scope:scope(),attemptId:attempt.id,intentId:attempt.dispatchIntent!.id,owner:attempt.owner,expectedVersion:attempt.version,
    observation:{scopeDigest:releaseHash(scope()),resourceDigest:resource,evidenceDigest:releaseHash('readback'),observedAt:stamp(0),status,
      spentCents:10,readbackComplete:true,noDeliveryProven:status==='rejected'},...patch,
  })
  async function ingest(r=envelope(),client=verifier) {return (await client.query('select campaign_verifier.ingest($1) result',[r])).rows[0].result}
  it('atomically certifies and adopts authenticated evidence; exact replay writes nothing',async()=>{
    await register();const r=envelope(), result=await ingest(r), before=await snapshot()
    expect(result).toMatchObject({outcome:'confirmed',completionRecorded:true,attemptVersion:2,campaignSpentCents:10,campaignReservedCents:0,providerEnabled:false,dispatched:false,dispatchEligible:false})
    expect(await ingest(r)).toEqual(result);expect(await snapshot()).toEqual(before)
    expect((await admin.query('select * from campaign_verifier.inspection')).rowCount).toBe(1)
    await expect(ingest({...r,receiptId:id(999)})).rejects.toThrow('Conflicting verifier replay')
  })
  it('generated provisioning rotates/revokes real adopted evidence without releasing accounting or reviving old authority',async()=>{
    await register()
    await admin.query('delete from campaign_verifier.identities; delete from campaign_verifier.credential_references')
    const make=(operation:'provision'|'activate'|'rotate'|'revoke',version=1)=>generateVerifierProvisioning({
      protocol:'campaign-verifier-provisioning/v1',commandId:id(sequence++),operation,targetId:id(499),databaseName:'campaign_phase10_test',
      identity:{principal:'campaign_v_lifecycle',verifierId:id(402),version},
      credential:{referenceId:id(401),version,provider:scope().provider,accountDigest:releaseHash(scope().accountId),environment:'staging',brokerEntryDigest:'b'.repeat(64)},
      expectedIdentityVersion:operation==='provision'?0:operation==='rotate'?version-1:version,
      expectedCredentialVersion:operation==='provision'?0:operation==='rotate'?version-1:version,expiresAt:stamp(600000),
    })
    const apply=async(p:ReturnType<typeof make>)=>{
      await admin.query('begin')
      try{await admin.query("select set_config('campaign.provisioning_authorization',$1,true)",[p.packetDigest]);await admin.query(p.sql);await admin.query('commit')}
      catch(e){await admin.query('rollback');throw e}
    }
    await apply(make('provision'));const activation=make('activate');await apply(activation)
    const caller=new Client({connectionString:url!.replace('postgres:local-synthetic-only@','campaign_v_lifecycle:local-synthetic-only@')});await caller.connect()
    try{
      const r=envelope();await ingest(r,caller)
      const journal=await snapshot(),evidence=(await admin.query('select * from campaign_verifier.evidence')).rows
      await apply(make('rotate',2))
      expect((await admin.query('select revoked_at from campaign_verifier.authorizations')).rows[0].revoked_at).not.toBeNull()
      expect((await admin.query('select campaign_verifier.is_current($1) ok',[id(403)])).rows[0].ok).toBe(false)
      await expect(ingest(envelope(),caller)).rejects.toThrow('permission denied')
      await apply(activation) // historical retry cannot reactivate version 1
      expect((await admin.query('select active from campaign_verifier.identities')).rows[0].active).toBe(false)
      await apply(make('activate',2));await apply(make('revoke',2))
      await expect(apply(make('activate',2))).rejects.toThrow('Revoked version')
      expect(await snapshot()).toEqual(journal)
      expect((await admin.query('select * from campaign_verifier.evidence')).rows).toEqual(evidence)
    }finally{await caller.end()}
  })
  it('accepted then unknown retains cap until confirmation',async()=>{
    await register();expect(await ingest(envelope('accepted'))).toMatchObject({outcome:'accepted',campaignReservedCents:50,campaignSpentCents:0})
    await current();expect(await ingest(envelope('unknown'))).toMatchObject({outcome:'uncertain',campaignReservedCents:50})
    await current();expect(await ingest()).toMatchObject({outcome:'confirmed',campaignSpentCents:10,campaignReservedCents:0})
  })
  it.each(['rejected','confirmed'])('incomplete %s proof remains uncertain',async status=>{
    await register();const r=envelope(status);r.certificationId=null;r.observation.readbackComplete=false;r.observation.noDeliveryProven=false
    expect(await ingest(r)).toMatchObject({outcome:'uncertain',campaignReservedCents:50,completionRecorded:false})
  })
  it('positive no-delivery rejection settles once without completion',async()=>{
    await register();expect(await ingest(envelope('rejected'))).toMatchObject({outcome:'rejected',completionRecorded:false,campaignReservedCents:0,campaignSpentCents:10})
  })
  it.each(['credentialVersion','credentialReferenceId','verifierVersion','verifierId','accountId','environment','contentHash','destinationDigest','actionId'])('rejects scope %s drift',async key=>{
    await register();const r=envelope();Object.assign(r.scope,{[key]:key.endsWith('Version')?2:key.endsWith('Id')?id(999):key==='environment'?'production':releaseHash('wrong')})
    await expect(ingest(r)).rejects.toThrow();expect((await snapshot()).ledger).toHaveLength(1)
  })
  it.each(['attemptId','intentId','owner','expectedVersion'])('rejects current fence %s drift',async key=>{
    await register();await expect(ingest(envelope('confirmed',{[key]:key==='expectedVersion'?8:key==='owner'?'wrong':id(999)}))).rejects.toThrow()
  })
  it.each(['resourceDigest','scopeDigest','evidenceDigest'])('rejects bad observation %s',async key=>{
    await register();const r=envelope();Object.assign(r.observation,{[key]:key==='evidenceDigest'?'invalid':releaseHash('wrong')})
    await expect(ingest(r)).rejects.toThrow('Exact authenticated')
  })
  it.each(['credential','verifier','revocation','expired','future','lease','source','approval','missing'])('rejects fresh %s authority drift',async mode=>{
    await register()
    if(mode==='credential')await admin.query('update campaign_verifier.credential_references set version=2')
    if(mode==='verifier')await admin.query('update campaign_verifier.identities set active=false')
    if(mode==='revocation')await admin.query('update campaign_verifier.authorizations set revoked_at=clock_timestamp()')
    if(mode==='expired')await admin.query("update campaign_verifier.authorizations set not_before=clock_timestamp()-interval '2 seconds',expires_at=clock_timestamp()-interval '1 second'")
    if(mode==='future')await admin.query("update campaign_verifier.authorizations set not_before=clock_timestamp()+interval '1 minute'")
    if(mode==='lease')await expire()
    if(mode==='source')await admin.query("update social_content_queue set body='changed'")
    if(mode==='approval')await admin.query('update agent_runs set metadata=$1',[decideCampaignRelease(x.record,x.record.hash,'hold','portfolio:synthetic',new Date())])
    if(mode==='missing')await admin.query('delete from campaign_verifier.identities')
    await expect(ingest()).rejects.toThrow();expect((await snapshot()).ledger).toHaveLength(1)
    expect((await admin.query('select * from campaign_provider_qualification_receipts')).rowCount).toBe(0)
  })
  it.each([-1,51])('enforces cumulative spend %s',async spentCents=>{
    await register();const r=envelope();r.observation.spentCents=spentCents;await expect(ingest(r)).rejects.toThrow()
  })
  it('rejects cumulative regression',async()=>{
    await register();await ingest(envelope('accepted'));await current();const r=envelope();r.observation.spentCents=9;await expect(ingest(r)).rejects.toThrow('regressed')
  })
  it.each([-3600000,3600000])('rejects stale/future observation %s',async offset=>{
    await register();const r=envelope();r.observation.observedAt=stamp(offset);await expect(ingest(r)).rejects.toThrow('stale')
  })
  it('denies API roles and unrelated authenticated logins, even with spoofed GUC',async()=>{
    await register()
    for(const role of ['anon','authenticated','service_role']) {
      await worker.query(`set role ${role}`);await expect(ingest(envelope(),worker)).rejects.toThrow('permission denied')
    }
    await worker.query('set role service_role')
    const untrusted=new Client({connectionString:url!.replace('postgres:local-synthetic-only@','unrelated_verifier:local-synthetic-only@')});await untrusted.connect()
    try {await untrusted.query("set request.jwt.claims = '{\"role\":\"synthetic_verifier\"}'");await expect(ingest(envelope(),untrusted)).rejects.toThrow('query returned no rows')}
    finally {await untrusted.end()}
    await expect(verifier.query('select * from campaign_verifier.credential_references')).rejects.toThrow('permission denied')
    await expect(verifier.query('select campaign_issue_provider_certification($1)',[issueRequest()])).rejects.toThrow('permission denied')
  })
  it('serializes concurrent replay and rejects conflicting concurrent requests',async()=>{
    await register();const second=new Client({connectionString:url!.replace('postgres:local-synthetic-only@','synthetic_verifier:local-synthetic-only@')});await second.connect()
    try {const r=envelope();const [a,b]=await Promise.all([ingest(r),ingest(r,second)]);expect(a).toEqual(b)
      await expect(ingest({...r,receiptId:id(992)},second)).rejects.toThrow('Conflicting')
      expect((await admin.query('select * from campaign_verifier.evidence')).rowCount).toBe(1)
    } finally {await second.end()}
  })
  it('crash rollback leaves no partial qualification/certificate/adoption; retry commits once',async()=>{
    await register();const r=envelope();await verifier.query('begin');await ingest(r);await verifier.query('rollback')
    expect((await admin.query('select * from campaign_provider_qualification_receipts')).rowCount).toBe(0)
    expect((await snapshot()).ledger).toHaveLength(1);expect((await ingest(r)).completionRecorded).toBe(true)
  })
  it('expiry during registry lock wait retains reservation',async()=>{
    await register();const r=envelope();await admin.query('begin')
    await admin.query("update campaign_verifier.authorizations set expires_at=clock_timestamp()+interval '150 milliseconds'")
    const pid=(await verifier.query('select pg_backend_pid() pid')).rows[0].pid
    const pending=ingest(r).catch(e=>e);await waitForPid(pid);await new Promise(r=>setTimeout(r,200));await admin.query('commit')
    expect(await pending).toBeInstanceOf(Error);expect((await snapshot()).ledger).toHaveLength(1)
  })
  it('durable evidence is append-only and revocation cannot turn replay into new authority',async()=>{
    await register();const r=envelope();const result=await ingest(r)
    await admin.query('update campaign_verifier.authorizations set revoked_at=clock_timestamp()')
    expect(await ingest(r)).toEqual(result)
    await expect(admin.query('delete from campaign_verifier.evidence')).rejects.toThrow('append-only')
    await current();await expect(ingest(envelope('accepted'))).rejects.toThrow()
  })
  it.each(['linkedin','instagram','facebook','x','tiktok','gmail','heygen','youtube','manual_social'] as const)('qualifies %s readback through exact provider family',async provider=>{
    x=data(provider);await seed();attempt=(await call()).attempt;await register()
    expect(await ingest()).toMatchObject({outcome:'confirmed',completionRecorded:true,providerEnabled:false})
  })
  it.each(['credential','verifier','authorization','certificate'])('fresh dependency and inspection fail after %s revocation',async mode=>{
    await register();const r=envelope();await ingest(r);await current()
    expect((await admin.query('select campaign_provider_dependency_confirmed($1) ok',[attempt])).rows[0].ok).toBe(true)
    if(mode==='credential')await admin.query('update campaign_verifier.credential_references set active=false')
    if(mode==='verifier')await admin.query('update campaign_verifier.identities set version=2')
    if(mode==='authorization')await admin.query('update campaign_verifier.authorizations set revoked_at=clock_timestamp()')
    if(mode==='certificate')await admin.query('select campaign_revoke_provider_certification($1)',[{certificationId:id(405),evidenceDigest:releaseHash('revoked')}])
    expect((await admin.query('select campaign_provider_dependency_confirmed($1) ok',[attempt])).rows[0].ok).toBe(false)
    const inspection={scope:scope(),attemptId:attempt.id,intentId:attempt.dispatchIntent!.id,owner:attempt.owner,expectedVersion:attempt.version}
    expect((await worker.query('select campaign_inspect_provider_certification($1) result',[inspection])).rows[0].result.certificationReady).toBe(false)
    expect((await ingest(r)).dispatchEligible).toBe(false)
  })
  it('rolls back receipt/certificate when downstream adoption fails',async()=>{
    await register();await editAttempt({reservedCents:49});await expect(ingest()).rejects.toThrow('reservation mismatch')
    for(const table of ['campaign_provider_qualification_receipts','campaign_provider_certifications','campaign_provider_adoptions'])expect((await admin.query(`select * from ${table}`)).rowCount).toBe(0)
  })
  it('does not expose private schema functions or tables through API roles',async()=>{
    for(const role of ['anon','authenticated','service_role']) {
      expect((await admin.query("select has_schema_privilege($1,'campaign_verifier','usage') ok",[role])).rows[0].ok).toBe(false)
      expect((await admin.query("select has_function_privilege($1,'campaign_verifier.ingest(jsonb)','execute') ok",[role])).rows[0].ok).toBe(false)
    }
    expect((await admin.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='campaign_verifier' and c.relkind='r' and not c.relrowsecurity")).rows[0].n).toBe(0)
  })
  it('runs the server bridge end to end through authenticated private SQL',async()=>{
    await register();const r=envelope() as VerifierRequest
    const bridge=new CampaignProviderVerifierBridge({ingest:r=>ingest(r)},[{provider:'linkedin',verifierId:id(402),version:1,verify:(_s,o)=>({...o})}])
    expect(await bridge.ingest(r)).toMatchObject({outcome:'confirmed',attemptVersion:2,dispatchEligible:false})
    expect(await bridge.ingest(r)).toMatchObject({outcome:'confirmed',attemptVersion:2,dispatchEligible:false})
  })
  it('disconnect before commit rolls back and retry remains possible',async()=>{
    await register();const r=envelope(), lost=new Client({connectionString:url!.replace('postgres:local-synthetic-only@','synthetic_verifier:local-synthetic-only@')})
    await lost.connect();await lost.query('begin');await ingest(r,lost);await lost.end()
    expect((await ingest(r)).outcome).toBe('confirmed')
    expect((await admin.query('select * from campaign_verifier.evidence')).rowCount).toBe(1)
  })
  it('concurrent conflicting commands have exactly one winner',async()=>{
    await register();const second=new Client({connectionString:url!.replace('postgres:local-synthetic-only@','synthetic_verifier:local-synthetic-only@')});await second.connect()
    try {const r=envelope();const results=await Promise.allSettled([ingest(r),ingest({...r,receiptId:id(990)},second)])
      expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1)
      expect((await admin.query('select * from campaign_verifier.evidence')).rowCount).toBe(1)
    } finally {await second.end()}
  })
  // Keep one full committed transaction for physical restart verification.
  it('leaves a durable final replay fixture',async()=>{await register();await ingest()})
})
