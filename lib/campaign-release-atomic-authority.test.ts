// @vitest-environment node
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AtomicCampaignAuthority, type AtomicCampaignRequest } from './campaign-release-atomic-authority'
import { approvalIdentity } from './campaign-release-activation'
import { campaignActionKeys, campaignSourceFingerprint, decideCampaignRelease, releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import { CampaignDispatchFence } from './campaign-release-dispatch'
import { DurableCampaignExecutionStore } from './campaign-release-durable-store'
import { attemptFence, emptyExecutionState } from './campaign-release-execution'
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

describe('atomic adapter fail-closed contract', () => {
  it.each([null, {}, { protocol: 'campaign-atomic-sandbox/v1', providerEnabled: true }])('rejects ambiguous RPC result %j', async response => {
    const x = data(), client = { rpc: vi.fn(async () => ({ data: response, error: null })) }
    const adapter = new AtomicCampaignAuthority(client, { read: async () => x.record, assertCurrentSources: async () => {} })
    await expect(adapter.authorize(x.request)).rejects.toThrow('ambiguous')
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })
  it.each(['throw', 'error'])('never retries an uncertain %s', async mode => {
    const x = data(), client = { rpc: vi.fn(async () => { if (mode === 'throw') throw new Error('lost'); return { data: null, error: 'unavailable' } }) }
    const adapter = new AtomicCampaignAuthority(client, { read: async () => x.record, assertCurrentSources: async () => {} })
    await expect(adapter.authorize(x.request)).rejects.toThrow()
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })
})

describe.skipIf(!url)('real PostgreSQL atomic authority', () => {
  let admin: Client, worker: Client, other: Client
  let x: ReturnType<typeof data>
  async function connect() {
    if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/campaign_phase6_test') throw new Error('Disposable local database only')
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
  }, 30000)
  afterAll(async () => { await Promise.all([admin?.end(), worker?.end(), other?.end()]) })
  beforeEach(async () => { x = data(); await seed() })

  it('commits canonical identity, immutable keys, source digest, claim and budget together; exact replay is a no-op', async () => {
    const result = await call()
    expect(result).toMatchObject({ providerEnabled: false, protocol: 'campaign-atomic-sandbox/v1', attempt: { reservedCents:50, state:'claimed', dispatchIntent: { status:'prepared', mode:'disabled' } } })
    expect(result.attempt.dispatchIntent.sourceDigest).toBe(releaseHash(x.record.manifest.actions.map(a => a.source)))
    expect(await call()).toEqual(result)
    expect((await snapshot()).version).toBe(1); expect((await snapshot()).ledger).toHaveLength(1)
  })
  it('round-trips through the server adapter and reconstructed adapter', async () => {
    const rpc = { rpc: async (_: string, args?: Record<string,unknown>) => ({ data: await call(worker,args!.request as ReturnType<typeof payload>), error:null }) }
    const source = { read: async () => x.record, assertCurrentSources: async () => {} }
    const result = await new AtomicCampaignAuthority(rpc,source).authorize(x.request)
    expect(await new AtomicCampaignAuthority(rpc,source).authorize(x.request)).toEqual(result)
  })
  it('dispatch replays atomic authority and always returns provider disabled', async () => {
    const source={read:async()=>x.record,assertCurrentSources:async()=>{}}
    const rpc={rpc:async(name:string,args?:Record<string,unknown>)=>({data:name==='campaign_execution_snapshot' ? await snapshot() : await call(worker,args!.request as ReturnType<typeof payload>),error:null})}
    const fence=new CampaignDispatchFence(source,new DurableCampaignExecutionStore(rpc),new AtomicCampaignAuthority(rpc,source))
    const attempt=await fence.authorizeSandbox(x.request)
    expect(await fence.dispatch(attemptFence(attempt),1,new Date())).toMatchObject({dispatched:false,reason:'Atomic sandbox intent qualified. Provider dispatch disabled.'})
    await expect(fence.dispatch({...attemptFence(attempt),owner:'stale'},1,new Date())).rejects.toThrow('ownership')
    await expect(new CampaignDispatchFence(source,new DurableCampaignExecutionStore(rpc)).authorizeSandbox(x.request)).rejects.toThrow('unavailable')
  })
  it.each(['hold','revise','stop'] as const)('%s that owns canonical lock first prevents claim', async decision => {
    await admin.query('begin')
    const changed = decideCampaignRelease(x.record,x.record.hash,decision,'portfolio:synthetic',new Date())
    await admin.query('update public.agent_runs set metadata=$1 where id=$2',[changed,x.request.releaseId])
    const pid = await waiting(worker), pending = call().then(() => 'unexpected', e => String(e))
    // Observer needs a separate connection because admin holds an open transaction.
    await waitForPid(pid); await admin.query('commit')
    expect(await pending).toContain('Canonical approval')
    expect((await snapshot()).attempts).toEqual({})
  })
  it.each(['hold','revise','stop'] as const)('claim commits before racing %s; replay then refuses', async decision => {
    await worker.query('begin'); await call()
    const mutator = await connect()
    try {
      const pid = await waiting(mutator)
      const changed = decideCampaignRelease(x.record,x.record.hash,decision,'portfolio:synthetic',new Date())
      const pending = mutator.query('update public.agent_runs set metadata=$1 where id=$2',[changed,x.request.releaseId])
      await waitForPid(pid); await worker.query('commit'); await pending
      expect((await snapshot()).ledger).toHaveLength(1)
      await expect(call()).rejects.toThrow('Canonical approval')
    } finally { await mutator.end() }
  })
  it.each(['body','evidence'])('source %s update racing claim is locked and rejects replay', async column => {
    await worker.query('begin'); await call()
    const mutator = await connect()
    try {
      const pid = await waiting(mutator)
      const pending = mutator.query(`update public.social_content_queue set ${column}=$1 where id=$2`, [column === 'body' ? 'changed' : {consent:'revoked'},x.source.id])
      await waitForPid(pid); await worker.query('commit'); await pending
      await expect(call()).rejects.toThrow('Source or evidence drift')
    } finally { await mutator.end() }
  })
  it('source edit committed before a waiting claim refuses without reservation', async () => {
    await admin.query('begin'); await admin.query("update public.social_content_queue set body='changed' where id=$1",[x.source.id])
    const pid = await waiting(worker), pending = call().then(()=>'unexpected',e=>String(e))
    await waitForPid(pid); await admin.query('commit')
    expect(await pending).toContain('Source or evidence drift'); expect((await snapshot()).ledger).toEqual([])
  })
  it.each(['hash','approvalVersion','auditHash','record','deliveryKey','authorizationKey','contentHash','dependencyDigest','journalVersion','owner','requestId'] as const)('refuses stale or invalid %s', async key => {
    const p = payload()
    Object.assign(p,{[key]:key === 'record' ? {...x.record,state:'held'} : key === 'approvalVersion' || key === 'journalVersion' ? 10 : key === 'owner' ? '' : 'bad'})
    await expect(call(worker,p)).rejects.toThrow(); expect((await snapshot()).ledger).toEqual([])
  })
  it('refuses expired evidence even with matching canonical record and binding', async () => {
    x.record.manifest.actions[0].evidenceExpiresAt = stamp(-1)
    x.record.hash=releaseHash(x.record.manifest);x.record.audit[0].hash=x.record.hash;x.request.hash=x.record.hash
    const state=emptyExecutionState();state.releases[x.request.releaseId]=x.record
    state.approvalBindings={ [x.request.releaseId]: {releaseId:x.request.releaseId,manifestHash:x.record.hash,approvalVersion:2,auditHash:releaseHash(x.record.audit),status:'bound',executionEnabled:false,checkedAt:stamp(0)} }
    await admin.query('update public.agent_runs set metadata=$1',[x.record]);await admin.query('update public.campaign_execution_journal set state=$1',[state])
    await expect(call()).rejects.toThrow('Evidence expired')
  })
  it('duplicate requests racing create exactly one intent and one reservation', async () => {
    const results = await Promise.all([call(),call(other)])
    expect(results[0]).toEqual(results[1]);expect((await snapshot()).ledger).toHaveLength(1)
  })
  it('different request/owner cannot reuse a delivery, including after lease takeover', async () => {
    await call()
    await expect(call(other,{...payload(),owner:'other',requestId:id(10),journalVersion:1})).rejects.toThrow('Duplicate')
    const state=await snapshot(), key=payload().deliveryKey
    state.attempts[key].owner='recovery';state.attempts[key].version=2
    await admin.query('update public.campaign_execution_journal set state=$1',[state])
    await expect(call()).rejects.toThrow('ownership')
  })
  it('expired lease refuses exact replay', async () => {
    await call();const state=await snapshot();state.attempts[payload().deliveryKey].leaseUntil=stamp(-1)
    await admin.query('update public.campaign_execution_journal set state=$1',[state]);await expect(call()).rejects.toThrow('ownership')
  })
  it('journal CAS writer winning first prevents atomic claim', async () => {
    const state=await snapshot();state.version=1
    await other.query('begin');await other.query('select campaign_execution_commit(0,$1)',[state])
    const pid=await waiting(worker), pending=call().then(()=>'unexpected',e=>String(e))
    await waitForPid(pid);await other.query('commit');expect(await pending).toContain('CAS conflict')
  })
  it('legacy CAS and direct table writes cannot forge, erase, or recover atomic receipts', async () => {
    const initial=await snapshot();initial.version=1;initial.attempts.fake={dispatchIntent:{status:'prepared',atomicRequest:{requestId:id(9)}}}
    await expect(worker.query('select campaign_execution_commit(0,$1)',[initial])).rejects.toThrow('legacy CAS disabled')
    await call();const state=await snapshot();state.version=2;state.attempts={};state.ledger=[]
    await expect(worker.query('select campaign_execution_commit(1,$1)',[state])).rejects.toThrow('legacy CAS disabled')
    await expect(worker.query('update campaign_execution_journal set state=$1',[state])).rejects.toThrow('permission denied')
  })
  it('budget exhaustion rolls back every intent field', async () => {
    const state=await snapshot();state.attempts.prior={releaseId:x.request.releaseId,reservedCents:60,spentCents:0}
    await admin.query('update campaign_execution_journal set state=$1',[state])
    await expect(call()).rejects.toThrow('Budget exhausted');expect((await snapshot()).ledger).toEqual([])
  })
  it('requires exact confirmed dependency receipt and digest', async () => {
    const first=x.record.manifest.actions[0]
    const next={...structuredClone(first),id:id(5),source:{...first.source,id:id(6)},dependsOn:[first.id]}
    x.record.manifest.actions.push(next);x.record.hash=releaseHash(x.record.manifest);x.record.audit[0].hash=x.record.hash;x.request.hash=x.record.hash;x.request.actionId=next.id
    const secondSource={...x.source,id:id(6)};next.source.fingerprint=campaignSourceFingerprint(secondSource)
    x.record.hash=releaseHash(x.record.manifest);x.record.audit[0].hash=x.record.hash;x.request.hash=x.record.hash
    await seed();await admin.query('insert into social_content_queue(id,body,evidence) values($1,$2,$3)',[secondSource.id,secondSource.body,secondSource.evidence])
    await expect(call()).rejects.toThrow('Dependency receipt mismatch')
    const state=await snapshot(),keys=campaignActionKeys(x.record.manifest,first.id)
    const receipt={trust:'synthetic',provider:first.provider,accountId:first.accountId,actionKey:keys.deliveryKey,contentHash:keys.contentHash,receiptType:first.expectedReceipt,providerId:'synthetic:confirmed',receivedAt:stamp(-1000)}
    state.attempts[keys.deliveryKey]={...keys,releaseId:x.request.releaseId,manifestHash:x.record.hash,state:'confirmed',reservedCents:0,spentCents:50,receipt}
    await admin.query('update campaign_execution_journal set state=$1',[state]);await expect(call()).rejects.toThrow('Dependency digest')
    x.request.dependencyDigest=releaseHash({[first.id]:releaseHash(receipt)})
    for (const mismatch of [{trust:'provider_accepted'}, {accountId:'wrong'}, {contentHash:'wrong'}, {actionKey:'wrong'}, {receiptType:'wrong'}, {receivedAt:stamp(60000)}]) {
      const invalid=structuredClone(state);invalid.attempts[keys.deliveryKey].receipt={...receipt,...mismatch}
      await admin.query('update campaign_execution_journal set state=$1',[invalid])
      await expect(call()).rejects.toThrow('Dependency receipt mismatch')
    }
    await admin.query('update campaign_execution_journal set state=$1',[state])
    expect((await call()).attempt.dispatchIntent.status).toBe('prepared')
  })
  it('rollback before commit leaves no claim; lost response after commit supports explicit exact replay', async () => {
    await worker.query('begin');await call();await worker.query('rollback')
    expect((await snapshot()).attempts).toEqual({});expect((await snapshot()).ledger).toEqual([])
    await call() // discard response, reconstruct connection
    const reconnect=await connect();await reconnect.query('set role service_role')
    try { expect((await call(reconnect)).attempt.reservedCents).toBe(50);expect((await snapshot()).ledger).toHaveLength(1) } finally { await reconnect.end() }
  })
  it.each(['anon','authenticated'])('%s cannot invoke authority or read journal', async role => {
    const client=await connect()
    try { await client.query(`set role ${role}`);await expect(call(client)).rejects.toThrow('permission denied');await expect(client.query('select * from campaign_execution_journal')).rejects.toThrow('permission denied') } finally {await client.end()}
  })
  it('disconnect before COMMIT rolls back a persisted-in-transaction intent', async () => {
    const doomed=await connect(); await doomed.query('set role service_role');await doomed.query('begin');await call(doomed)
    await doomed.end()
    expect((await snapshot()).attempts).toEqual({});expect((await snapshot()).ledger).toEqual([])
    expect((await call()).attempt.dispatchIntent.status).toBe('prepared')
  })
  it('replay after another journal transition fails closed', async () => {
    await call();const state=await snapshot();state.version++
    await admin.query('update campaign_execution_journal set version=$1,state=$2',[state.version,state])
    await expect(call()).rejects.toThrow('stale ownership')
  })
  it('canonical audit corruption cannot be hidden by matching the request', async () => {
    x.record.audit[0].actor='untrusted';await admin.query('update agent_runs set metadata=$1',[x.record])
    await expect(call()).rejects.toThrow('Canonical approval')
  })
  it('SQL canonical hashing matches admitted UTF8, string escaping and numeric values', async () => {
    for(const value of [{z:'é雪😀',a:'line\nquote"\\tab\t'},[null,true,false,1,0,1.5],{a:{x:[]}}]) {
      const result=await admin.query('select campaign_authority_hash($1::jsonb) hash',[JSON.stringify(value)])
      expect(result.rows[0].hash).toBe(releaseHash(value))
    }
  })
  it('leaves one committed intent for physical restart verification', async () => { await call();expect((await snapshot()).ledger).toHaveLength(1) })
})
