import { DurableCampaignExecutionStore } from './campaign-release-durable-store'
import { CampaignDispatchFence } from './campaign-release-dispatch'
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { type AtomicCampaignRequest } from './campaign-release-atomic-authority'
import { approvalIdentity } from './campaign-release-activation'
import { campaignActionKeys, campaignSourceFingerprint, decideCampaignRelease, releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import { emptyExecutionState } from './campaign-release-execution'
import { fixture } from './campaign-release-test-fixture'

const url = process.env.CAMPAIGN_CERTIFICATION_TEST_URL
const migration = readFileSync('supabase/migrations/20261003233618_campaign_atomic_sandbox_authority.sql', 'utf8')
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`
const stamp = (offset: number) => new Date(Date.now() + offset).toISOString()
function data() {
  const manifest = fixture()
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

import { type AtomicRecoveryCommand } from './campaign-release-atomic-recovery'
import type { ExecutionAttempt } from './campaign-release-execution'
describe.skipIf(!url)('real PostgreSQL provider certification', () => {
  let admin: Client, worker: Client, other: Client
  let x: ReturnType<typeof data>
  async function connect() {
    if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/campaign_phase8_test') throw new Error('Disposable local database only')
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
    await admin.query('insert into public.social_content_queue(id,body,evidence) values($1,$2,$3) on conflict(id) do update set body=excluded.body,evidence=excluded.evidence', [x.source.id,x.source.body,x.source.evidence])
  }
  async function waiting(client: Client) {
    const pid = (await client.query('select pg_backend_pid() pid')).rows[0].pid
    // Fetch PID before launching a blocked query; this helper is used by waitForPid.
    return pid as number
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
  const command = (operation: AtomicRecoveryCommand['operation'] = 'inspect', patch: Partial<AtomicRecoveryCommand> = {}) => ({
    commandId: id(sequence++), operation, releaseId: attempt.releaseId, hash: attempt.manifestHash,
    deliveryKey: attempt.deliveryKey, authorizationKey: attempt.authorizationKey, contentHash: attempt.contentHash,
    attemptId: attempt.id, intentId: attempt.dispatchIntent!.id, owner: attempt.owner, expectedVersion: attempt.version, ...patch,
  })
  async function recover(c = command(), client = worker) {
    return (await client.query('select public.campaign_recover_atomic_intent($1::jsonb) result', [{...c, actor:'portfolio:reviewer'}])).rows[0].result
  }
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
    await worker.query('set role service_role'); await other.query('set role service_role')
    x=data();await seed();await call();const beforeUpgrade=await snapshot()
    await admin.query(readFileSync('supabase/migrations/20261004001737_campaign_atomic_recovery.sql','utf8'))
    await admin.query(readFileSync('supabase/migrations/20261004005627_campaign_provider_certification.sql','utf8'))
    if (process.env.CAMPAIGN_WITH_ADOPTION === '1') await admin.query(readFileSync('supabase/migrations/20261004011705_campaign_provider_receipt_adoption.sql','utf8'))
    expect(await snapshot()).toEqual(beforeUpgrade)
  }, 30000)
  afterAll(async () => { await Promise.all([admin?.end(), worker?.end(), other?.end()]) })
  beforeEach(async () => { x = data(); await seed(); await admin.query(`truncate ${process.env.CAMPAIGN_WITH_ADOPTION === '1'?'campaign_provider_adoptions,campaign_provider_resource_claims,campaign_provider_attempt_bindings,':''}campaign_provider_certification_revocations,campaign_provider_certifications,campaign_provider_qualification_receipts,campaign_provider_qualifications; delete from campaign_atomic_recovery_commands`); attempt = (await call()).attempt })

  const scope = (patch: Partial<CertificationScope> = {}) => ({...campaignCertificationScope(x.record,x.request.actionId,{
    environment:'staging',credentialReferenceId:id(401),credentialVersion:1,mode:'no_delivery',verifierId:id(402),verifierVersion:1,
  }),...patch})
  const plan = (patch: Record<string,unknown> = {}) => ({runId:id(403),scope:scope(),stage:'provider_readback',approvalReferenceId:id(404),expiresAt:stamp(1800000),...patch})
  const receipt = (patch: Record<string,unknown> = {}) => ({receiptId:id(sequence++),runId:id(403),scopeDigest:releaseHash(scope()),
    verifierId:id(402),verifierVersion:1,outcome:'confirmed',spentCents:10,evidenceDigest:releaseHash('readback'),resourceDigest:releaseHash('exact-provider-resource'),
    observedAt:stamp(0),readbackComplete:true,noDeliveryProven:true,...patch})
  const issueRequest = () => ({certificationId:id(405),runId:id(403),expiresAt:stamp(600000)})
  const prepare = (p=plan(), client=admin) => client.query('select campaign_prepare_provider_qualification($1) result',[p])
  const record = (r=receipt(), client=admin) => client.query('select campaign_record_provider_qualification($1) result',[r])
  const issue = (r=issueRequest(), client=admin) => client.query('select campaign_issue_provider_certification($1) result',[r])
  const inspect = (s=scope(), client=worker) => new CampaignProviderCertification({rpc:async(_name,args)=>{
    const r=await client.query('select campaign_inspect_provider_certification($1) result',[args!.request]);return {data:r.rows[0].result,error:null}
  }}).inspect(s,attempt)
  const run = async () => (await admin.query('select * from campaign_provider_qualifications')).rows[0]
  async function certified() { await prepare();await record();await issue() }

  it('requires certification, then reports exact evidence while all dispatch remains disabled',async()=>{
    expect(await inspect()).toMatchObject({certificationReady:false,dispatchEligible:false,blocker:'certification_missing'})
    const before=await snapshot();await certified()
    expect(await inspect()).toMatchObject({certificationReady:true,dispatchEligible:false,providerEnabled:false,dispatched:false,blocker:'provider_disabled',certificationId:id(405)})
    expect(await snapshot()).toEqual(before)
  })
  it('acceptance and uncertainty retain reservations; reconciliation settles spend once',async()=>{
    const p=plan();await prepare(p);await prepare(p)
    const r=receipt({outcome:'accepted',spentCents:5,readbackComplete:false});await record(r);await record(r)
    expect(await run()).toMatchObject({state:'accepted',reserved_cents:'45',spent_cents:'5'})
    await expect(issue()).rejects.toThrow('readback qualification required')
    await record(receipt({outcome:'uncertain',spentCents:5,readbackComplete:false}))
    await expect(record(receipt({outcome:'accepted',spentCents:5}))).rejects.toThrow('Uncertainty')
    await record();expect(await run()).toMatchObject({state:'confirmed',reserved_cents:'0',spent_cents:'10'})
    await expect(record()).rejects.toThrow('Invalid qualification receipt')
    expect((await admin.query('select count(*) from campaign_provider_qualification_receipts')).rows[0].count).toBe('3')
  })
  it.each(['accountId','credentialReferenceId','credentialVersion','environment','mode','verifierId','verifierVersion'] as const)('rejects stale %s scope',async key=>{
    await certified();const s=scope(); const values={accountId:'wrong-account',credentialReferenceId:id(410),credentialVersion:2,environment:'production',mode:'controlled_delivery',verifierId:id(411),verifierVersion:2}
    const changed={...s,[key]:values[key]} as CertificationScope
    if(key==='accountId') await expect(inspect(changed)).rejects.toThrow()
    else expect(await inspect(changed)).toMatchObject({certificationReady:false,dispatchEligible:false})
  })
  it.each(['contentHash','authorizationKey','destinationDigest','spendCapCents'] as const)('refuses changed %s action identity',async key=>{
    await certified(); const s=scope(); const value=key==='spendCapCents'?49:key==='authorizationKey'?`campaign-authorization:${releaseHash('wrong')}`:releaseHash('wrong')
    await expect(inspect({...s,[key]:value})).rejects.toThrow()
  })
  it.each(['hold','stop','revise'] as const)('current %s removes certification readiness',async decision=>{
    await certified();const changed=decideCampaignRelease(x.record,x.record.hash,decision,'portfolio:synthetic',new Date())
    await admin.query('update agent_runs set metadata=$1 where id=$2',[changed,x.request.releaseId])
    expect(await inspect()).toMatchObject({certificationReady:false,blocker:'atomic_recovery_required'})
  })
  it('source drift and expired/released ownership require recovery',async()=>{
    await certified();await admin.query("update social_content_queue set body='changed'")
    expect(await inspect()).toMatchObject({certificationReady:false,blocker:'atomic_recovery_required'})
    await seed();await call(); // restores approved source, new exact intent
    attempt=(await snapshot()).attempts[attempt.deliveryKey];await expire()
    expect(await inspect()).toMatchObject({certificationReady:false,blocker:'atomic_recovery_required'})
    await recover(command('release'))
    await expect(inspect()).rejects.toThrow()
  })
  it.each(['expiry','revocation'])('refuses certificate %s',async why=>{
    await certified();await admin.query(why==='expiry'?"update campaign_provider_certifications set expires_at=clock_timestamp()-interval '1 second'":"select campaign_revoke_provider_certification(jsonb_build_object('certificationId',certification_id,'evidenceDigest',repeat('a',64))) from campaign_provider_certifications")
    expect(await inspect()).toMatchObject({certificationReady:false,blocker:'certification_expired_or_revoked'})
  })
  it('requires exact verifier, resource and no-delivery/readback evidence',async()=>{
    await prepare(); await record(receipt({outcome:'accepted',readbackComplete:false}))
    for(const patch of [{verifierId:id(410)},{verifierVersion:2},{scopeDigest:releaseHash('wrong')},{resourceDigest:releaseHash('wrong')},
      {noDeliveryProven:false},{readbackComplete:false},{observedAt:stamp(100000)}]) await expect(record(receipt(patch))).rejects.toThrow()
    expect((await run()).state).toBe('accepted')
  })
  it('refuses overspend, regression and rejected outcome without no-delivery proof',async()=>{
    await prepare();await record(receipt({outcome:'uncertain',spentCents:20}))
    for(const patch of [{spentCents:51},{spentCents:19},{outcome:'rejected',spentCents:20,noDeliveryProven:false}]) await expect(record(receipt(patch))).rejects.toThrow()
    expect(await run()).toMatchObject({state:'uncertain',spent_cents:'20',reserved_cents:'30'})
    await record(receipt({outcome:'rejected',spentCents:20}));expect((await run()).reserved_cents).toBe('0')
  })
  it('rejects conflicting run and receipt replay, including concurrent callbacks',async()=>{
    const p=plan();await prepare(p)
    await expect(prepare({...p,runId:id(410)})).rejects.toThrow('Conflicting qualification replay')
    const r=receipt({outcome:'accepted'});const connection=await connect()
    try { await Promise.all([record(r),record(r,connection)]) } finally {await connection.end()}
    await expect(record({...r,outcome:'confirmed'})).rejects.toThrow('Conflicting receipt replay')
    expect((await admin.query('select count(*) from campaign_provider_qualification_receipts')).rows[0].count).toBe('1')
  })
  it('local and hosted contracts can never issue provider certification',async()=>{
    for(const stage of ['local_contract','hosted_contract']) {
      const s=scope({environment:stage==='local_contract'?'local':'staging'})
      const runId=id(sequence++);await prepare(plan({runId,scope:s,stage}));await record(receipt({runId,scopeDigest:releaseHash(s)}))
      await expect(issue({...issueRequest(),runId})).rejects.toThrow('readback qualification required')
    }
  })
  it('parks SMS and rejects unbounded or secret-bearing reference fields',async()=>{
    for(const s of [scope({provider:'sms',operation:'send_sms',receiptType:'sms_delivery_receipt'}),scope({credentialReferenceId:'raw-secret'}),scope({spendCapCents:-1}),{...scope(),secret:'never-store'}]) {
      await expect(prepare(plan({scope:s}))).rejects.toThrow()
    }
    expect((await admin.query('select count(*) from campaign_provider_qualifications')).rows[0].count).toBe('0')
  })
  it('controlled delivery cannot recycle delivery ownership across releases',async()=>{
    const s=scope({mode:'controlled_delivery'});await prepare(plan({scope:s}))
    await expect(prepare(plan({runId:id(415),scope:{...s,releaseId:id(416),manifestHash:releaseHash('revision')}}))).rejects.toThrow(process.env.CAMPAIGN_WITH_ADOPTION === '1'?'Controlled delivery already reserved':'Current atomic intent')
  })
  it('controlled qualification completion requires journal reconciliation, never redispatch',async()=>{
    const s=scope({mode:'controlled_delivery'});await prepare(plan({scope:s}));await record(receipt({scopeDigest:releaseHash(s),noDeliveryProven:false}));await issue()
    expect(await inspect(s)).toMatchObject({certificationReady:false,dispatchEligible:false,blocker:'qualification_delivery_requires_reconciliation'})
    expect((await snapshot()).attempts[attempt.deliveryKey].reservedCents).toBe(50)
  })
  it('a prepared controlled run blocks recovery release even before callback evidence',async()=>{
    await prepare(plan({scope:scope({mode:'controlled_delivery'})}))
    const result=await recover(command('release'))
    expect(result).toMatchObject({outcome:'reconciliation_required',noInvocationProven:false,attempt:{reservedCents:50}})
    attempt=result.attempt
    expect(await recover(command('renew'))).toMatchObject({outcome:'reconciliation_required',noInvocationProven:false})
  })
  it('controlled preparation wins the journal lock and recovery retains money',async()=>{
    await admin.query('begin');await prepare(plan({scope:scope({mode:'controlled_delivery'})}))
    const pid=await waiting(worker),pending=recover(command('release'));await waitForPid(pid);await admin.query('commit')
    expect(await pending).toMatchObject({outcome:'reconciliation_required',noInvocationProven:false,attempt:{reservedCents:50}})
  })
  it('recovery release wins the journal lock and blocks new controlled preparation',async()=>{
    await worker.query('begin');expect((await recover(command('release'))).outcome).toBe('released')
    const client=await connect()
    try {
      const pid=await waiting(client);const pending=prepare(plan({scope:scope({mode:'controlled_delivery'})}),client).catch(error=>error)
      await waitForPid(pid);await worker.query('commit');expect((await pending).message).toContain('Current atomic intent')
    } finally {await client.end()}
  })
  it('the dispatch fence uses fresh certification evidence and rejects stale ownership',async()=>{
    await certified()
    const client={rpc:async(name:string,args?:Record<string,unknown>)=>{
      const query=name==='campaign_execution_snapshot'?'select campaign_execution_snapshot() result':'select campaign_inspect_provider_certification($1) result'
      const r=await worker.query(query,name==='campaign_execution_snapshot'?[]:[args!.request]);return {data:r.rows[0].result,error:null}
    }}
    const fence=new CampaignDispatchFence({read:async()=>x.record,assertCurrentSources:async()=>{}},new DurableCampaignExecutionStore(client),undefined,new CampaignProviderCertification(client))
    expect(await fence.inspectProviderReadiness({deliveryKey:attempt.deliveryKey,owner:attempt.owner,version:attempt.version},scope())).toMatchObject({certificationReady:true,dispatchEligible:false})
    await expect(fence.inspectProviderReadiness({deliveryKey:attempt.deliveryKey,owner:'wrong',version:attempt.version},scope())).rejects.toThrow('ownership fence')
  })
  it.each(Object.entries(campaignCertificationContracts).filter(([p])=>p!=='sms'))('qualifies SQL scope for %s without a transport',async(provider,contract)=>{
    const s={...scope(),provider,operation:contract.operation,receiptType:contract.receipt}
    await prepare(plan({scope:s}));await record(receipt({scopeDigest:releaseHash(s)}));await issue()
    expect((await run()).state).toBe('confirmed')
  })
  it('expiry retains uncertain money and forbids late completion certification',async()=>{
    await prepare();await record(receipt({outcome:'uncertain',spentCents:5}))
    await admin.query("update campaign_provider_qualifications set expires_at=clock_timestamp()-interval '1 second'")
    await expect(record()).rejects.toThrow('Current completion proof')
    expect(await run()).toMatchObject({reserved_cents:'45',spent_cents:'5',state:'uncertain'})
  })
  it('retains unknown resource outcomes and binds the first authenticated readback resource',async()=>{
    await prepare();await record(receipt({outcome:'uncertain',resourceDigest:null,spentCents:0,readbackComplete:false}))
    expect(await run()).toMatchObject({state:'uncertain',reserved_cents:'50'})
    await expect(issue()).rejects.toThrow('readback qualification required')
    await expect(record(receipt({resourceDigest:null}))).rejects.toThrow('Invalid qualification receipt')
    await record();await issue();expect(await inspect()).toMatchObject({certificationReady:true,dispatchEligible:false})
  })
  it('before-commit rollback leaves no run; after-commit receipt loss replays without new spend',async()=>{
    const p=plan();await admin.query('begin');await prepare(p);await admin.query('rollback')
    expect((await admin.query('select count(*) from campaign_provider_qualifications')).rows[0].count).toBe('0')
    await prepare(p);const r=receipt({outcome:'uncertain',spentCents:5});await record(r)
    const before=await run();const client=await connect()
    try {await record(r,client)} finally {await client.end()}
    expect(await run()).toEqual(before)
  })
  it('certificate issuance is idempotent and revocation cannot be undone by replay',async()=>{
    await prepare();await record();const r=issueRequest();await issue(r);await issue(r)
    const revoke={certificationId:r.certificationId,evidenceDigest:releaseHash('revoked')}
    await admin.query('select campaign_revoke_provider_certification($1)',[revoke]);await admin.query('select campaign_revoke_provider_certification($1)',[revoke])
    await issue(r);expect(await inspect()).toMatchObject({certificationReady:false})
    await expect(admin.query('select campaign_revoke_provider_certification($1)',[{...revoke,evidenceDigest:releaseHash('conflict')}])).rejects.toThrow('Conflicting revocation')
  })
  it('persists all ledger evidence across a new connection and does not alter recovery budget',async()=>{
    await certified();const client=await connect()
    try { expect((await client.query('select count(*) from campaign_provider_certifications')).rows[0].count).toBe('1') } finally {await client.end()}
    const r=await recover(command('release'));expect(r.attempt.reservedCents).toBe(0)
    expect((await admin.query('select count(*) from campaign_provider_certifications')).rows[0].count).toBe('1')
  })
  it('API roles cannot create qualifications, import evidence, issue certs or write tables',async()=>{
    for(const role of ['anon','authenticated','service_role']) {
      await other.query(`set role ${role}`)
      await expect(prepare(plan(),other)).rejects.toThrow('permission denied')
      await expect(record(receipt(),other)).rejects.toThrow('permission denied')
      await expect(issue(issueRequest(),other)).rejects.toThrow('permission denied')
      await expect(other.query('select * from campaign_provider_certifications')).rejects.toThrow('permission denied')
      if(role!=='service_role') await expect(inspect(scope(),other)).rejects.toThrow()
    }
  })
  it('stop wins a real lock race before certification inspection',async()=>{
    await certified(); await admin.query('begin')
    await admin.query('update agent_runs set metadata=$1 where id=$2',[decideCampaignRelease(x.record,x.record.hash,'stop','portfolio:synthetic',new Date()),x.request.releaseId])
    const pid=await waiting(worker), pending=inspect();await waitForPid(pid);await admin.query('commit')
    expect(await pending).toMatchObject({certificationReady:false,blocker:'atomic_recovery_required'})
  })
  it('inspection orders before a following stop but never returns a delivery permit',async()=>{
    await certified();await worker.query('begin');expect(await inspect()).toMatchObject({certificationReady:true,dispatchEligible:false})
    const client=await connect()
    try {
      const pid=await waiting(client);const pending=client.query('update agent_runs set metadata=$1 where id=$2',[decideCampaignRelease(x.record,x.record.hash,'stop','portfolio:synthetic',new Date()),x.request.releaseId])
      await waitForPid(pid);await worker.query('commit');await pending
      expect(await inspect()).toMatchObject({certificationReady:false})
    } finally {await client.end()}
  })
})

import { CampaignProviderCertification, campaignCertificationScope, certificationScopeSchema, type CertificationScope } from './campaign-release-provider-certification'
describe('provider certification adapter',()=>{
  it.each(Object.entries(campaignCertificationContracts))('models %s operation and expected receipt', (provider,contract)=>{
    const x=data();const scope=campaignCertificationScope(x.record,x.request.actionId,{environment:'local',credentialReferenceId:id(1),credentialVersion:1,mode:'no_delivery',verifierId:id(2),verifierVersion:1})
    expect(certificationScopeSchema.safeParse({...scope,provider,operation:contract.operation,receiptType:contract.receipt}).success).toBe(true)
    expect(certificationScopeSchema.safeParse({...scope,provider,operation:'invalid'}).success).toBe(false)
  })
  it.each(['throws','error','enabled','missing evidence','wrong scope','wrong attempt'])('fails closed on %s RPC response without retry',async scenario=>{
    const x=data(),s=campaignCertificationScope(x.record,x.request.actionId,{environment:'local',credentialReferenceId:id(1),credentialVersion:1,mode:'no_delivery',verifierId:id(2),verifierVersion:1})
    const attempt={id:id(3),releaseId:s.releaseId,actionId:s.actionId,manifestHash:s.manifestHash,deliveryKey:s.deliveryKey,
      authorizationKey:s.authorizationKey,contentHash:s.contentHash,owner:'worker',version:1,dispatchIntent:{id:id(4),atomicRequest:x.request}} as ExecutionAttempt
    const result={protocol:'campaign-provider-certification/v1',providerEnabled:false,dispatched:false,dispatchEligible:false,
      certificationReady:true,scopeDigest:releaseHash(s),attemptId:attempt.id,attemptVersion:1,checkedAt:stamp(0),blocker:'provider_disabled',nextAction:'Review activation',certificationId:id(5),evidenceDigest:releaseHash('evidence')}
    const rpc=vi.fn(async()=>{
      if(scenario==='throws') throw new Error('connection lost')
      return {error:scenario==='error'?'unavailable':null,data:{...result,
        ...(scenario==='enabled'?{dispatchEligible:true}:{}),...(scenario==='missing evidence'?{evidenceDigest:null}:{}),
        ...(scenario==='wrong scope'?{scopeDigest:releaseHash('wrong')}:{}),...(scenario==='wrong attempt'?{attemptId:id(10)}:{})}}
    })
    await expect(new CampaignProviderCertification({rpc}).inspect(s,attempt)).rejects.toThrow()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('refuses unbound attempts without calling RPC',async()=>{
    const rpc=vi.fn(); const x=data(); const s=campaignCertificationScope(x.record,x.request.actionId,{environment:'local',credentialReferenceId:id(1),credentialVersion:1,mode:'no_delivery',verifierId:id(2),verifierVersion:1})
    await expect(new CampaignProviderCertification({rpc}).inspect(s,{} as ExecutionAttempt)).rejects.toThrow('Exact atomic intent')
    expect(rpc).not.toHaveBeenCalled()
  })
})
import { campaignCertificationContracts } from './campaign-release-certification'
