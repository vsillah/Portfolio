import { DurableCampaignExecutionStore } from './campaign-release-durable-store'
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { type AtomicCampaignRequest } from './campaign-release-atomic-authority'
import { approvalIdentity } from './campaign-release-activation'
import { campaignActionKeys, campaignSourceFingerprint, decideCampaignRelease, releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import { CampaignExecutionJournal, emptyExecutionState } from './campaign-release-execution'
import { fixture } from './campaign-release-test-fixture'

const url = process.env.CAMPAIGN_ATOMIC_TEST_URL
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

import { AtomicCampaignRecovery, type AtomicRecoveryCommand } from './campaign-release-atomic-recovery'
import type { ExecutionAttempt } from './campaign-release-execution'
describe.skipIf(!url)('real PostgreSQL atomic recovery', () => {
  let admin: Client, worker: Client, other: Client
  let x: ReturnType<typeof data>
  async function connect() {
    if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/campaign_phase7_test') throw new Error('Disposable local database only')
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
    expect(await snapshot()).toEqual(beforeUpgrade)
  }, 30000)
  afterAll(async () => { await Promise.all([admin?.end(), worker?.end(), other?.end()]) })
  beforeEach(async () => { x = data(); await seed(); await admin.query('delete from campaign_atomic_recovery_commands'); attempt = (await call()).attempt })

  it('inspects the exact committed intent after lease expiry and unrelated journal progression', async () => {
    await expire(); const state = await snapshot(); state.version++
    state.releases[id(90)] = {marker:'unrelated'}
    expect((await worker.query('select campaign_execution_commit(1,$1) ok',[state])).rows[0].ok).toBe(true)
    const result = await recover()
    expect(result).toMatchObject({outcome:'inspected',providerEnabled:false,dispatched:false,eligible:true,noInvocationProven:true,journalVersion:2})
    expect(result.attempt).toEqual(attempt)
    expect(await snapshot()).toEqual(state)
  })
  it('renews the same owner, preserves immutable intent and keys, and fences older owners', async () => {
    await expire(); const old = structuredClone(attempt), c = command('renew')
    const result = await recover(c)
    expect(result.outcome).toBe('renewed'); expect(result.attempt.version).toBe(2)
    expect(result.attempt.owner).toBe(old.owner); expect(result.attempt.dispatchIntent).toEqual(old.dispatchIntent)
    expect(Date.parse(result.attempt.leaseUntil)).toBeGreaterThan(Date.now())
    expect((await snapshot()).ledger).toHaveLength(1)
    await expect(recover(command('renew'))).rejects.toThrow('fence changed')
    expect(await recover(c)).toEqual(result)
  })
  it('refuses an unreviewed distinct-owner takeover', async () => {
    await expire()
    await expect(recover(command('renew',{owner:'intruder'}))).rejects.toThrow('fence changed')
    await expect(recover(command('takeover',{newOwner:'reconciler'}))).rejects.toThrow('review required')
    expect((await snapshot()).attempts[attempt.deliveryKey]).toEqual(attempt)
  })
  it('requires a separate current review, then transfers once without delivery authority', async () => {
    await expire(); const c = command('review_takeover',{newOwner:'reconciler',reviewNote:'Reviewed expired disabled intent'})
    expect((await recover(c)).outcome).toBe('takeover_reviewed')
    const takeover = command('takeover',{newOwner:'reconciler',reviewCommandId:c.commandId})
    const result = await recover(takeover)
    expect(result).toMatchObject({outcome:'takeover',providerEnabled:false,dispatched:false,attempt:{owner:'reconciler',version:2}})
    expect(result.attempt.dispatchIntent).toEqual(attempt.dispatchIntent)
    expect(await recover(takeover)).toEqual(result)
    await expect(recover(command('takeover',{newOwner:'reconciler',reviewCommandId:c.commandId}))).rejects.toThrow('fence changed')
  })
  it.each(['expired','wrong owner','renewed'])('refuses %s takeover review', async scenario => {
    await expire();const c=command('review_takeover',{newOwner:'reconciler',reviewNote:'reviewed'})
    await recover(c)
    if(scenario==='expired') await admin.query("update campaign_atomic_recovery_commands set created_at=clock_timestamp()-interval '6 minutes'")
    if(scenario==='renewed') { const r=await recover(command('renew'));attempt=r.attempt;await expire() }
    await expect(recover(command('takeover',{newOwner:scenario==='wrong owner'?'wrong':'reconciler',reviewCommandId:c.commandId}))).rejects.toThrow('review required')
  })
  it.each(['hold','revise','stop'] as const)('%s wins lock race and recovery terminally retains reservation',async decision=>{
    await admin.query('begin')
    const changed=decideCampaignRelease(x.record,x.record.hash,decision,'portfolio:synthetic',new Date())
    await admin.query('update agent_runs set metadata=$1 where id=$2',[changed,x.request.releaseId])
    const pid=await waiting(worker),pending=recover(command('renew'))
    await waitForPid(pid);await admin.query('commit')
    const result=await pending
    expect(result).toMatchObject({outcome:'reconciliation_required',eligible:false,attempt:{state:'reconciliation_required',reservedCents:50}})
    expect(result.attempt.dispatchIntent).toEqual(attempt.dispatchIntent)
  })
  it.each(['hold','revise','stop'] as const)('renewal commits first; subsequent %s blocks another renewal',async decision=>{
    await worker.query('begin'); const result=await recover(command('renew')); attempt=result.attempt
    const mutator=await connect()
    try {
      const pid=await waiting(mutator)
      const changed=decideCampaignRelease(x.record,x.record.hash,decision,'portfolio:synthetic',new Date())
      const pending=mutator.query('update agent_runs set metadata=$1 where id=$2',[changed,x.request.releaseId])
      await waitForPid(pid);await worker.query('commit');await pending
      expect((await recover(command('renew'))).outcome).toBe('reconciliation_required')
    } finally {await mutator.end()}
  })
  it('source drift racing renewal refuses; inspection still returns historical intent',async()=>{
    await admin.query('begin');await admin.query("update social_content_queue set body='changed' where id=$1",[x.source.id])
    const pid=await waiting(worker), pending=recover(command('renew'))
    await waitForPid(pid);await admin.query('commit')
    expect(await pending).toMatchObject({outcome:'reconciliation_required',eligible:false,reason:'Source or evidence drift'})
    expect((await recover()).attempt.dispatchIntent).toEqual(attempt.dispatchIntent)
  })
  it('renewal source lock serializes a later edit; next command reconciles',async()=>{
    await worker.query('begin');attempt=(await recover(command('renew'))).attempt
    const mutator=await connect()
    try {const pid=await waiting(mutator), pending=mutator.query("update social_content_queue set body='changed' where id=$1",[x.source.id])
      await waitForPid(pid);await worker.query('commit');await pending
      expect((await recover(command('renew'))).outcome).toBe('reconciliation_required')
    }finally {await mutator.end()}
  })
  it.each(['manifest','audit','binding','budget','dependency'])('revalidates %s drift',async drift=>{
    const state=await snapshot()
    if(drift==='manifest') {const record=structuredClone(x.record);record.manifest.spendCapCents=0;await admin.query('update agent_runs set metadata=$1',[record])}
    if(drift==='audit') {const record=structuredClone(x.record);record.audit[0].actor='portfolio:changed';await admin.query('update agent_runs set metadata=$1',[record])}
    if(drift==='binding') state.approvalBindings[x.request.releaseId].auditHash='changed'
    if(drift==='budget') state.attempts.other={releaseId:x.request.releaseId,reservedCents:100,spentCents:0}
    if(drift==='dependency') state.attempts[attempt.deliveryKey].dispatchIntent.atomicRequest.dependencyDigest=releaseHash({changed:true})
    await admin.query('update campaign_execution_journal set state=$1',[state])
    expect(await recover(command('renew'))).toMatchObject({outcome:'reconciliation_required',eligible:false,attempt:{reservedCents:50}})
  })
  it('explicit release proves disabled no-invocation, closes the attempt and never recreates delivery',async()=>{
    const c=command('release'),r=await recover(c)
    expect(r).toMatchObject({outcome:'released',noInvocationProven:true,attempt:{state:'stopped',reservedCents:0}})
    expect(r.attempt.dispatchIntent).toEqual(attempt.dispatchIntent)
    expect((await snapshot()).ledger).toHaveLength(2)
    expect(await recover(c)).toEqual(r)
    await expect(call()).rejects.toThrow('ownership')
    attempt=r.attempt;await recover(command('release'));expect((await snapshot()).ledger).toHaveLength(2)
  })
  it('release after stop remains explicit and does not restore authority',async()=>{
    await admin.query('update agent_runs set metadata=$1',[decideCampaignRelease(x.record,x.record.hash,'stop','portfolio:synthetic',new Date())])
    attempt=(await recover(command('renew'))).attempt
    expect(await recover(command('release'))).toMatchObject({outcome:'released',eligible:false,attempt:{reservedCents:0,state:'stopped'}})
  })
  it.each([{providerOutcome:'unknown'},{state:'submitted'},{receipt:{providerId:'unknown'}},{callbacks:{event:'unknown'}},{events:[{kind:'atomic_sandbox_authorized'},{kind:'provider_invoked'}]}])('unknown outcome remains reserved through repeated reconciliation: %j',async patch=>{
    await editAttempt(patch)
    for(let i=0;i<2;i++) {const r=await recover(command('release'));expect(r).toMatchObject({outcome:'reconciliation_required',noInvocationProven:false,attempt:{reservedCents:50}});attempt=r.attempt}
    expect((await snapshot()).ledger).toHaveLength(1)
  })
  it('simultaneous duplicate commands commit one renewal and one receipt',async()=>{
    const c=command('renew'), results=await Promise.all([recover(c),recover(c,other)])
    expect(results[0]).toEqual(results[1]);expect((await snapshot()).version).toBe(2)
    expect((await admin.query('select count(*) n from campaign_atomic_recovery_commands')).rows[0].n).toBe('1')
    await expect(recover({...c,operation:'release'})).rejects.toThrow('Conflicting')
  })
  it('response loss before commit rolls back; an explicit new process can inspect then retry',async()=>{
    const lost=await connect();await lost.query('set role service_role');await lost.query('begin')
    const c=command('renew');await recover(c,lost);await lost.end()
    expect((await snapshot()).version).toBe(1)
    expect((await recover()).attempt.version).toBe(1)
    expect((await recover(c)).attempt.version).toBe(2)
  })
  it('response loss after commit returns the durable receipt after intervening commands',async()=>{
    const c=command('renew');await recover(c)
    const fresh=await connect();await fresh.query('set role service_role')
    try {const r=await recover(c,fresh);attempt=r.attempt;await recover(command('release'))
      expect(await recover(c,fresh)).toEqual(r);expect((await snapshot()).ledger).toHaveLength(2)
    } finally {await fresh.end()}
  })
  it.each(['attempt','intent','ledger','release','binding','dependent','forgery'])('legacy writer cannot alter atomic %s',async change=>{
    const state=await snapshot();state.version++
    if(change==='attempt') delete state.attempts[attempt.deliveryKey]
    if(change==='intent') state.attempts[attempt.deliveryKey].dispatchIntent.status='refused'
    if(change==='ledger') state.ledger=[]
    if(change==='release') delete state.releases[attempt.releaseId]
    if(change==='binding') delete state.approvalBindings[attempt.releaseId]
    if(change==='dependent') state.attempts.new={releaseId:attempt.releaseId}
    if(change==='forgery') state.attempts.new={releaseId:id(88),dispatchIntent:{atomicRequest:{}}}
    await expect(worker.query('select campaign_execution_commit(1,$1)',[state])).rejects.toThrow(/Atomic|atomic/)
    expect((await snapshot()).version).toBe(1)
  })
  it('unrelated legacy CAS racing recovery gets conflict, reloads and progresses safely',async()=>{
    const state=await snapshot();state.version++;state.releases[id(88)]={marker:'unrelated'}
    await worker.query('begin');await recover(command('renew'))
    const pid=await waiting(other),pending=other.query('select campaign_execution_commit(1,$1) ok',[state])
    await waitForPid(pid);await worker.query('commit');expect((await pending).rows[0].ok).toBe(false)
    const fresh=await snapshot();fresh.version++;fresh.releases[id(88)]={marker:'unrelated'}
    expect((await other.query('select campaign_execution_commit(2,$1) ok',[fresh])).rows[0].ok).toBe(true)
    expect((await recover()).attempt.version).toBe(2)
  })
  it('legacy CAS commits first; recovery is fenced by attempt version, not global version',async()=>{
    const state=await snapshot();state.version++;state.releases[id(88)]={marker:'unrelated'}
    await other.query('begin');await other.query('select campaign_execution_commit(1,$1)',[state])
    const pid=await waiting(worker),pending=recover(command('renew'))
    await waitForPid(pid);await other.query('commit');expect(await pending).toMatchObject({outcome:'renewed',journalVersion:3})
  })
  it.each(['anon','authenticated'])('%s cannot call recovery or write command history',async role=>{
    const client=await connect()
    try{await client.query(`set role ${role}`);await expect(recover(command(),client)).rejects.toThrow('permission denied')
      await expect(client.query('select * from campaign_atomic_recovery_commands')).rejects.toThrow('permission denied')
    }finally{await client.end()}
  })
  it('service role cannot bypass recovery or its validator',async()=>{
    await expect(worker.query('delete from campaign_atomic_recovery_commands')).rejects.toThrow('permission denied')
    await expect(worker.query('update campaign_execution_journal set version=9')).rejects.toThrow('permission denied')
    await expect(worker.query('select campaign_validate_atomic_recovery($1)',[payload()])).rejects.toThrow('permission denied')
  })
  it('adapter and fresh adapter preserve the exact receipt with disabled delivery',async()=>{
    const rpc={rpc:async(_name:string,args?:Record<string,unknown>)=>({data:(await worker.query('select campaign_recover_atomic_intent($1) result',[args!.request])).rows[0].result,error:null})}
    const c=command('renew'),result=await new AtomicCampaignRecovery(rpc,'portfolio:reviewer').execute(c)
    expect(result.dispatched).toBe(false)
    expect(await new AtomicCampaignRecovery(rpc,'portfolio:reviewer').execute(c)).toEqual(result)
  })
  it.each(['attemptId','intentId','hash','deliveryKey','authorizationKey','contentHash'])('rejects mismatched exact %s',async field=>{
    await expect(recover({...command(),[field]:'wrong'})).rejects.toThrow('Exact committed')
    expect((await snapshot()).version).toBe(1)
  })
  it.each(['id','deliveryKey','authorizationKey'])('legacy aliases cannot recycle atomic %s',async field=>{
    const state=await snapshot();state.version++
    state.attempts.alias={releaseId:id(88),[field]:attempt[field as keyof ExecutionAttempt]}
    await expect(worker.query('select campaign_execution_commit(1,$1)',[state])).rejects.toThrow('alias atomic identity')
  })
  it('rechecks actual predecessor receipt identity and isolates it from legacy mutation',async()=>{
    const first=x.record.manifest.actions[0], next=structuredClone(first)
    next.id=id(65);next.source.id=id(66);next.dependsOn=[first.id]
    const secondSource={...x.source,id:next.source.id};next.source.fingerprint=campaignSourceFingerprint(secondSource)
    x.record.manifest.actions.push(next);x.record.hash=releaseHash(x.record.manifest);x.record.audit[0].hash=x.record.hash
    x.request.hash=x.record.hash;x.request.actionId=next.id
    await seed();await admin.query('insert into social_content_queue(id,body,evidence) values($1,$2,$3)',[secondSource.id,secondSource.body,secondSource.evidence])
    const state=await snapshot(),keys=campaignActionKeys(x.record.manifest,first.id)
    const receipt={trust:'synthetic',provider:first.provider,accountId:first.accountId,actionKey:keys.deliveryKey,contentHash:keys.contentHash,receiptType:first.expectedReceipt,providerId:'synthetic:confirmed',receivedAt:stamp(-1000)}
    state.attempts[keys.deliveryKey]={id:id(67),...keys,releaseId:x.request.releaseId,manifestHash:x.record.hash,state:'confirmed',reservedCents:0,spentCents:50,receipt}
    x.request.dependencyDigest=releaseHash({[first.id]:releaseHash(receipt)})
    await admin.query('update campaign_execution_journal set state=$1',[state]);attempt=(await call()).attempt
    expect((await recover()).eligible).toBe(true)
    const altered=await snapshot();altered.version++;altered.attempts[keys.deliveryKey].receipt.providerId='synthetic:replacement'
    await expect(worker.query('select campaign_execution_commit(1,$1)',[altered])).rejects.toThrow('Atomic attempts')
    // Trusted-owner drift simulates a future separately reviewed receipt migration.
    altered.version=1;await admin.query('update campaign_execution_journal set state=$1',[altered])
    expect(await recover(command('renew'))).toMatchObject({outcome:'reconciliation_required',eligible:false,reason:'Dependency digest changed'})
  })
  it('unrelated full journal prepare, approval and claim continue after an atomic intent',async()=>{
    const manifest=fixture();manifest.releaseId=id(89);manifest.campaignId=id(88)
    manifest.actions[0].source.id=id(87);manifest.createdAt=stamp(-60000);manifest.expiresAt=stamp(3600000)
    manifest.actions[0].scheduledFor=stamp(-1000);manifest.actions[0].evidenceExpiresAt=stamp(3600000)
    const rpc={rpc:async(name:string,args?:Record<string,unknown>)=>({data:name==='campaign_execution_snapshot' ? await snapshot() :
      (await worker.query('select campaign_execution_commit($1,$2) ok',[args!.expected_version,args!.next_state])).rows[0].ok,error:null})}
    const journal=new CampaignExecutionJournal(new DurableCampaignExecutionStore(rpc))
    const record={manifest,hash:releaseHash(manifest),state:'pending' as const,version:1,audit:[]}
    await journal.prepare(record);await journal.decide(manifest.releaseId,record.hash,'approve','portfolio:synthetic',new Date())
    await journal.claim({releaseId:manifest.releaseId,hash:record.hash,actionId:manifest.actions[0].id,owner:'other-worker',now:new Date()})
    expect((await snapshot()).attempts[attempt.deliveryKey]).toEqual(attempt)
    expect(Object.keys((await snapshot()).attempts)).toHaveLength(2)
    expect((await recover(command('renew'))).outcome).toBe('renewed')
  })
  it('concurrent renewal and reviewed takeover cannot both change the same fence',async()=>{
    await expire();const review=command('review_takeover',{newOwner:'reconciler',reviewNote:'reviewed'})
    await recover(review)
    const results=await Promise.allSettled([recover(command('renew')),recover(command('takeover',{newOwner:'reconciler',reviewCommandId:review.commandId}),other)])
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect(results.filter(r=>r.status==='rejected')).toHaveLength(1)
    expect((await snapshot()).attempts[attempt.deliveryKey].version).toBe(2)
  })
  it('expired authorization refuses renewal and preserves the reservation',async()=>{
    const historical=structuredClone(x.record)
    historical.manifest.expiresAt=stamp(-1);historical.hash=releaseHash(historical.manifest)
    // Canonical drift must refuse even before evaluating its expired time window.
    await admin.query('update agent_runs set metadata=$1',[historical])
    expect(await recover(command('renew'))).toMatchObject({eligible:false,outcome:'reconciliation_required',attempt:{reservedCents:50}})
  })
  it('leaves recovery, command history and reservation for physical restart verification',async()=>{
    await recover(command('renew'));const state=await snapshot()
    await admin.query('create table campaign_phase7_expected(state jsonb, commands jsonb)')
    await admin.query('insert into campaign_phase7_expected select $1, jsonb_agg(to_jsonb(c)) from campaign_atomic_recovery_commands c',[state])
  })
})

describe('recovery adapter fail closed',()=>{
  it.each([null,{}, {providerEnabled:true},{dispatched:true}])('rejects ambiguous %j',async data=>{
    const rpc={rpc:vi.fn(async()=>({data,error:null}))}
    await expect(new AtomicCampaignRecovery(rpc,'portfolio:reviewer').execute({} as AtomicRecoveryCommand)).rejects.toThrow('ambiguous')
    expect(rpc.rpc).toHaveBeenCalledTimes(1)
  })
  it.each(['throw','error'])('does not retry %s',async kind=>{
    const rpc={rpc:vi.fn(async()=>{if(kind==='throw')throw new Error('lost');return{data:null,error:'unavailable'}})}
    await expect(new AtomicCampaignRecovery(rpc,'portfolio:reviewer').execute({} as AtomicRecoveryCommand)).rejects.toThrow()
    expect(rpc.rpc).toHaveBeenCalledTimes(1)
  })
})
