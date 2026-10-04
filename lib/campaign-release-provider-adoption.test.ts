// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'
import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type AtomicCampaignRequest } from './campaign-release-atomic-authority'
import { approvalIdentity } from './campaign-release-activation'
import { campaignActionKeys, campaignSourceFingerprint, decideCampaignRelease, releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import { emptyExecutionState } from './campaign-release-execution'
import { fixture } from './campaign-release-test-fixture'

const url = process.env.CAMPAIGN_ADOPTION_TEST_URL
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
describe.skipIf(!url)('real PostgreSQL provider receipt adoption', () => {
  let admin: Client, worker: Client, other: Client
  let x: ReturnType<typeof data>
  async function connect() {
    if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/campaign_phase9_test') throw new Error('Disposable local database only')
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
    await admin.query(readFileSync('supabase/migrations/20261004011705_campaign_provider_receipt_adoption.sql','utf8'))
    expect(await snapshot()).toEqual(beforeUpgrade)
  }, 30000)
  afterAll(async () => { await Promise.all([admin?.end(), worker?.end(), other?.end()]) })
  afterEach(async () => { await Promise.all([admin,worker,other].map(c=>c.query('rollback'))) })
  beforeEach(async () => { x = data(); await seed(); await admin.query('truncate campaign_provider_adoptions,campaign_provider_resource_claims,campaign_provider_attempt_bindings,campaign_provider_certification_revocations,campaign_provider_certifications,campaign_provider_qualification_receipts,campaign_provider_qualifications; delete from campaign_atomic_recovery_commands'); attempt = (await call()).attempt })

  const scope = (patch: Partial<CertificationScope> = {}) => ({...campaignCertificationScope(x.record,x.request.actionId,{
    environment:'staging',credentialReferenceId:id(401),credentialVersion:1,mode:'controlled_delivery',verifierId:id(402),verifierVersion:1,
  }),...patch})
  const plan = (patch: Record<string,unknown> = {}) => ({runId:id(403),scope:scope(),stage:'provider_readback',approvalReferenceId:id(404),expiresAt:stamp(1800000),...patch})
  const receipt = (patch: Record<string,unknown> = {}) => ({receiptId:id(sequence++),runId:id(403),scopeDigest:releaseHash(scope()),
    verifierId:id(402),verifierVersion:1,outcome:'confirmed',spentCents:10,evidenceDigest:releaseHash('readback'),resourceDigest:releaseHash('exact-provider-resource'),
    observedAt:stamp(0),readbackComplete:true,noDeliveryProven:true,...patch})
  const issueRequest = () => ({certificationId:id(405),runId:id(403),expiresAt:stamp(600000)})
  const prepare = (p=plan(), client=admin) => client.query('select campaign_prepare_provider_qualification($1) result',[p])
  const record = (r=receipt(), client=admin) => client.query('select campaign_record_provider_qualification($1) result',[r])
  const issue = (r=issueRequest(), client=admin) => client.query('select campaign_issue_provider_certification($1) result',[r])

  const run = async () => (await admin.query('select * from campaign_provider_qualifications')).rows[0]



  let latest: ReturnType<typeof receipt>
  const adoption = (patch: Record<string,unknown> = {}) => ({ commandId:id(sequence++),receiptId:latest.receiptId,
    runId:id(403),scope:scope(),attemptId:attempt.id,intentId:attempt.dispatchIntent!.id,
    owner:attempt.owner,expectedVersion:attempt.version,certificationId:latest.outcome==='confirmed'?id(405):null,...patch })
  async function adopt(r=adoption(),client=admin) {
    return (await client.query('select campaign_adopt_provider_receipt($1) result',[r])).rows[0].result
  }
  async function evidence(outcome='confirmed',patch:Record<string,unknown>={}) {
    latest=receipt({outcome,...patch});await record(latest);if(outcome==='confirmed') await issue()
  }
  async function ready(outcome='confirmed') { await prepare();await evidence(outcome) }
  async function current() { attempt=(await snapshot()).attempts[attempt.deliveryKey];return attempt }

  it('adopts confirmed evidence once and exact retry recovers the historical result',async()=>{
    await ready();const r=adoption(), result=await adopt(r), before=await snapshot()
    expect(result).toMatchObject({outcome:'confirmed',completionRecorded:true,providerEnabled:false,dispatched:false,dispatchEligible:false,
      campaignReservedCents:0,campaignSpentCents:10,attempt:{state:'confirmed',version:2}})
    expect(result.attempt.receipt.providerId).toBe(`sha256:${latest.resourceDigest}`)
    expect(await adopt(r)).toEqual(result);expect(await snapshot()).toEqual(before)
    await expect(adopt({...r,commandId:id(sequence++)})).rejects.toThrow('Conflicting adoption replay')
    await expect(adopt({...r,expectedVersion:2})).rejects.toThrow('Conflicting adoption replay')
    expect(before.ledger.map((e:{kind:string})=>e.kind)).toEqual(['reserve','release','spend'])
    expect(await run()).toMatchObject({spent_cents:'10',reserved_cents:'0'})
  })
  it('acceptance and uncertainty reserve the full cap until final readback settles once',async()=>{
    await ready('accepted');let result=await adopt();expect(result).toMatchObject({outcome:'accepted',completionRecorded:false,campaignReservedCents:50,campaignSpentCents:0})
    await current();await evidence('uncertain',{spentCents:15});result=await adopt()
    expect(result).toMatchObject({outcome:'uncertain',attempt:{state:'reconciliation_required',reservedCents:50,spentCents:0}})
    await current();await evidence('confirmed',{spentCents:20});result=await adopt()
    expect(result).toMatchObject({outcome:'confirmed',campaignReservedCents:0,campaignSpentCents:20})
    expect((await snapshot()).ledger.filter((e:{kind:string})=>e.kind==='spend')).toHaveLength(1)
    expect((await admin.query('select * from campaign_provider_budget_reconciliation')).rows[0]).toMatchObject({
      reservation_owner:'campaign_execution_journal',effective_reserved_cents:'0',effective_spent_cents:'20',qualification_spent_cents:'20'})
  })
  it('rejected no-delivery settles known cost but permanently stops the attempt',async()=>{
    await ready('rejected');expect(await adopt()).toMatchObject({outcome:'rejected',attempt:{state:'stopped',spentCents:10,reservedCents:0}})
    await current();expect(await recover(command('renew'))).toMatchObject({outcome:'reconciliation_required',eligible:false,noInvocationProven:false,attempt:{state:'stopped'}})
  })
  it.each(['hold','revise','stop'] as const)('%s prevents completion eligibility while reconciling known final cost',async decision=>{
    await ready();await admin.query('update agent_runs set metadata=$1 where id=$2',[decideCampaignRelease(x.record,x.record.hash,decision,'portfolio:synthetic',new Date()),x.request.releaseId])
    expect(await adopt()).toMatchObject({outcome:'reconciliation_required',completionRecorded:false,spendSettled:true,campaignReservedCents:0,campaignSpentCents:10})
  })
  it.each(['source','lease','certificate','revocation','qualification','budget'])('%s drift cannot unlock a successor',async mode=>{
    await ready()
    if(mode==='source')await admin.query("update social_content_queue set body='changed'")
    if(mode==='lease')await expire()
    if(mode==='certificate')await admin.query("update campaign_provider_certifications set expires_at=clock_timestamp()-interval '1 second'")
    if(mode==='revocation')await admin.query("select campaign_revoke_provider_certification(jsonb_build_object('certificationId',certification_id,'evidenceDigest',repeat('a',64))) from campaign_provider_certifications")
    if(mode==='qualification')await admin.query("update campaign_provider_qualifications set expires_at=clock_timestamp()-interval '1 second'")
    if(mode==='budget')await editAttempt({reservedCents:49})
    if(mode==='budget')await expect(adopt()).rejects.toThrow('reservation mismatch')
    else expect(await adopt()).toMatchObject({outcome:'reconciliation_required',completionRecorded:false,campaignReservedCents:['source','lease'].includes(mode)?0:50})
  })
  it.each(['attemptId','intentId','owner','expectedVersion','accountId','credentialVersion','verifierVersion','destinationDigest','contentHash','authorizationKey','environment'])('rejects changed %s binding',async key=>{
    await ready();const r=adoption()
    const value=key.endsWith('Version')?99:key.endsWith('Id')?id(909):key==='environment'?'production':key.endsWith('Digest')||key.endsWith('Hash')?releaseHash('wrong'):'wrong'
    const changed=['attemptId','intentId','owner','expectedVersion'].includes(key)?{...r,[key]:value}:{...r,scope:{...r.scope,[key]:value}}
    await expect(adopt(changed)).rejects.toThrow();expect((await snapshot()).ledger).toHaveLength(1)
  })
  it('requires latest evidence and refuses missing preparation-time attempt binding',async()=>{
    await ready('accepted');const stale=adoption();await evidence('uncertain')
    await expect(adopt(stale)).rejects.toThrow('Latest exact')
    await admin.query('truncate campaign_provider_adoptions,campaign_provider_resource_claims,campaign_provider_attempt_bindings')
    await expect(adopt()).rejects.toThrow('query returned no rows')
  })
  it('refuses a resource identity already claimed by another run',async()=>{
    await ready()
    // Distinct no-delivery plan supplies a real FK while simulating another resource owner.
    await prepare(plan({runId:id(920),scope:scope({mode:'no_delivery'})}))
    await admin.query('insert into campaign_provider_attempt_bindings select $1,attempt_id,intent_id,owner,attempt_version,intent_digest,created_at from campaign_provider_attempt_bindings',[id(920)])
    await admin.query('insert into campaign_provider_resource_claims values($1,$2,$3,$4,$5)',[scope().provider,scope().accountId,'staging',latest.resourceDigest,id(920)])
    await expect(adopt()).rejects.toThrow('resource already adopted')
  })
  it.each(['inspect','renew','release','reconcile','review_takeover','takeover'] as const)('recovery %s cannot mutate an adopted outcome',async operation=>{
    await ready();await adopt();await current();const before=await snapshot()
    expect(await recover(command(operation))).toMatchObject({eligible:false,noInvocationProven:false,attempt:{state:'confirmed',spentCents:10,reservedCents:0}})
    expect(await snapshot()).toEqual(before)
  })
  it('simultaneous identical adoptions commit one settlement; conflicting replay fails',async()=>{
    await ready();const client=await connect(),r=adoption()
    try { const results=await Promise.all([adopt(r),adopt(r,client)]);expect(results[0]).toEqual(results[1]) } finally {await client.end()}
    expect((await admin.query('select count(*) from campaign_provider_adoptions')).rows[0].count).toBe('1')
    expect((await snapshot()).ledger).toHaveLength(3)
  })
  it('stop wins a canonical lock race before adoption',async()=>{
    await ready();await admin.query('begin')
    await admin.query('update agent_runs set metadata=$1 where id=$2',[decideCampaignRelease(x.record,x.record.hash,'stop','portfolio:synthetic',new Date()),x.request.releaseId])
    const client=await connect()
    try { const pid=await waiting(client),pending=adopt(adoption(),client);await waitForPid(pid);await admin.query('commit')
      expect(await pending).toMatchObject({outcome:'reconciliation_required',campaignReservedCents:0,spendSettled:true})
    } finally {await client.end()}
  })
  it('certificate expiry during its lock wait retains reservations',async()=>{
    await ready();await admin.query('begin');await admin.query("update campaign_provider_certifications set expires_at=clock_timestamp()+interval '200 milliseconds'")
    const client=await connect()
    try {const pid=await waiting(client),pending=adopt(adoption(),client);await waitForPid(pid);await new Promise(r=>setTimeout(r,250));await admin.query('commit')
      expect(await pending).toMatchObject({outcome:'reconciliation_required',campaignReservedCents:50})
    }finally{await client.end()}
  })
  it('rollback leaves no adoption; connection loss after commit recovers exact result',async()=>{
    await ready();const r=adoption(),before=await snapshot();await admin.query('begin');await adopt(r);await admin.query('rollback')
    expect(await snapshot()).toEqual(before);const result=await adopt(r),client=await connect()
    try{expect(await adopt(r,client)).toEqual(result)}finally{await client.end()}
  })
  it('adoption and recovery race cannot release or replace delivered ownership',async()=>{
    await ready();await admin.query('begin');await adopt();const client=await connect()
    try {const pid=await waiting(client),pending=recover(command('renew'),client).catch(e=>e);await waitForPid(pid);await admin.query('commit')
      expect((await pending).message).toContain('Recovery fence changed');expect((await current()).state).toBe('confirmed')
    }finally{await client.end()}
  })
  it('API roles lack mutation grants and evidence rows are append-only',async()=>{
    await ready();await adopt()
    for(const role of ['anon','authenticated','service_role']) {
      await other.query(`set role ${role}`)
      await expect(adopt(adoption(),other)).rejects.toThrow('permission denied')
      for(const table of ['campaign_provider_adoptions','campaign_provider_attempt_bindings','campaign_provider_resource_claims','campaign_provider_budget_reconciliation'])
        await expect(other.query(`select * from ${table}`)).rejects.toThrow('permission denied')
      const grants=await admin.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('campaign_adopt_provider_receipt','campaign_provider_dependency_confirmed','campaign_prepare_provider_qualification_v8','campaign_prepare_provider_qualification') and has_function_privilege($1,p.oid,'EXECUTE')",[role])
      expect(grants.rows).toEqual([])
    }
    for(const table of ['campaign_provider_adoptions','campaign_provider_attempt_bindings','campaign_provider_resource_claims','campaign_provider_qualification_receipts'])
      await expect(admin.query(`delete from ${table}`)).rejects.toThrow('append-only')
  })
  it.each(Object.entries(campaignCertificationContracts).filter(([p])=>p!=='sms'))('adopts %s exact provider receipt contract',async(provider,contract)=>{
    x.record.manifest.actions[0].provider=provider as typeof x.record.manifest.actions[0]['provider']
    x.record.manifest.actions[0].operation=contract.operation as typeof x.record.manifest.actions[0]['operation']
    x.record.manifest.actions[0].expectedReceipt=contract.receipt as typeof x.record.manifest.actions[0]['expectedReceipt']
    const action=x.record.manifest.actions[0]
    if(provider==='gmail'||provider==='manual_social') {
      x.record.manifest.class='relationship_outreach_batch';action.source.table='outreach_queue'
      action.recipients=[{address:'fixture@example.invalid',consentEvidenceId:'fixture-consent',suppressionEvidenceId:'fixture-clear'}]
    }else if(provider==='heygen') action.source.table='video_generation_jobs'
    await admin.query(`insert into ${action.source.table}(id,body,evidence) values($1,$2,$3) on conflict(id) do update set body=excluded.body,evidence=excluded.evidence`,[x.source.id,x.source.body,x.source.evidence])
    x.record.hash=releaseHash(x.record.manifest);x.record.audit[0].hash=x.record.hash;x.request.hash=x.record.hash
    await seed();attempt=(await call()).attempt;await ready();expect(await adopt()).toMatchObject({outcome:'confirmed',attempt:{receipt:{provider,receiptType:contract.receipt}}})
  })
  it('only an exact confirmed adoption unlocks the eligible disabled successor path',async()=>{
    const first=x.record.manifest.actions[0], second=structuredClone(first)
    second.id=id(940);second.dependsOn=[first.id];second.copy.body='successor content';second.accountId='successor-account'
    x.record.manifest.actions.push(second);x.record.hash=releaseHash(x.record.manifest);x.record.audit[0].hash=x.record.hash;x.request.hash=x.record.hash
    await seed();attempt=(await call()).attempt;await ready('accepted');await adopt();await current()
    const successor=async()=>{const state=await snapshot();const predecessor=state.attempts[attempt.deliveryKey]
      return call(worker,{...payload(),actionId:second.id,...campaignActionKeys(x.record.manifest,second.id),requestId:id(941),journalVersion:state.version,
        dependencyDigest:releaseHash({[first.id]:predecessor.receipt?releaseHash(predecessor.receipt):'unconfirmed'})})}
    await expect(successor()).rejects.toThrow('Dependency receipt mismatch')
    await evidence();await adopt();await current();expect(await successor()).toMatchObject({providerEnabled:false,attempt:{state:'claimed',dispatchIntent:{mode:'disabled'}}})
    await admin.query("select campaign_revoke_provider_certification(jsonb_build_object('certificationId',certification_id,'evidenceDigest',repeat('b',64))) from campaign_provider_certifications")
    await expect(successor()).rejects.toThrow('Dependency receipt mismatch')
  })
  it('never reserves the same delivery in a second environment',async()=>{
    await prepare();await expect(prepare(plan({runId:id(950),scope:scope({environment:'production'})}))).rejects.toThrow('already reserved across environments')
    expect((await admin.query('select count(*) from campaign_provider_qualifications')).rows[0].count).toBe('1')
  })
  it('unknown-resource uncertainty retains money and cannot be resent by recovery',async()=>{
    await prepare();await evidence('uncertain',{spentCents:0,resourceDigest:null,readbackComplete:false});await adopt();await current()
    expect(await recover(command('release'))).toMatchObject({noInvocationProven:false,attempt:{reservedCents:50,spentCents:0}})
    expect((await admin.query('select count(*) from campaign_provider_resource_claims')).rows[0].count).toBe('0')
  })
  it('certificate revocation winning its lock forces reconciliation without settlement',async()=>{
    await ready();await admin.query('begin')
    await admin.query("select campaign_revoke_provider_certification(jsonb_build_object('certificationId',certification_id,'evidenceDigest',repeat('c',64))) from campaign_provider_certifications")
    const client=await connect()
    try{const pid=await waiting(client),pending=adopt(adoption(),client);await waitForPid(pid);await admin.query('commit')
      expect(await pending).toMatchObject({outcome:'reconciliation_required',spendSettled:false,campaignReservedCents:50})
    }finally{await client.end()}
  })
  it('forged or missing receipt trust cannot impersonate a durable confirmed adoption',async()=>{
    await ready();await adopt();await current()
    expect((await admin.query('select campaign_provider_dependency_confirmed($1) ok',[attempt])).rows[0].ok).toBe(true)
    const forged=structuredClone(attempt);delete forged.receipt!.trust
    expect((await admin.query('select campaign_provider_dependency_confirmed($1) ok',[forged])).rows[0].ok).toBe(false)
    forged.receipt!.trust='provider_confirmed';forged.receipt!.providerId='forged-resource'
    expect((await admin.query('select campaign_provider_dependency_confirmed($1) ok',[forged])).rows[0].ok).toBe(false)
  })
  it('append-only evidence rejects changed payload and extra raw input fields',async()=>{
    await ready();await expect(adopt(adoption({providerPayload:'must never persist'}))).rejects.toThrow('Exact adoption command')
    expect((await admin.query('select count(*) from campaign_provider_adoptions')).rows[0].count).toBe('0')
    await expect(admin.query("update campaign_provider_qualification_receipts set request=request || '{\"spentCents\":99}'::jsonb")).rejects.toThrow('append-only')
  })
  it('successor authority expires while waiting for a predecessor certificate',async()=>{
    const first=x.record.manifest.actions[0],second=structuredClone(first)
    second.id=id(970);second.accountId='successor-account';second.dependsOn=[first.id]
    x.record.manifest.actions.push(second);x.record.manifest.expiresAt=stamp(800)
    x.record.hash=releaseHash(x.record.manifest);x.record.audit[0].hash=x.record.hash;x.request.hash=x.record.hash
    await seed();attempt=(await call()).attempt;await ready();await adopt();await current()
    const state=await snapshot(),request={...payload(),actionId:second.id,...campaignActionKeys(x.record.manifest,second.id),
      requestId:id(971),journalVersion:state.version,dependencyDigest:releaseHash({[first.id]:releaseHash(attempt.receipt)})}
    await admin.query('begin');await admin.query('select * from campaign_provider_certifications for update')
    const pid=await waiting(worker),pending=call(worker,request).catch(e=>e)
    await waitForPid(pid);await new Promise(r=>setTimeout(r,850));await admin.query('commit')
    expect((await pending).message).toContain('Authority expired during dependency wait')
    expect(Object.keys((await snapshot()).attempts)).toHaveLength(1)
  })
  it('leaves durable adoption for physical restart and exact historical retry',async()=>{
    await ready();await adopt()
  })
})

import { campaignCertificationScope, type CertificationScope } from './campaign-release-provider-certification'
import { campaignCertificationContracts } from './campaign-release-certification'

// Guard against accidentally wiring this private boundary into ordinary execution.
describe('provider adoption registration boundary',()=>{
  it('has no production caller, transport, credential resolver or activation registration',()=>{
    const scan=(directory:string):string[]=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
      const path=join(directory,entry.name)
      return entry.isDirectory()?scan(path):/\.[cm]?[jt]sx?$/.test(entry.name)&&!entry.name.includes('.test.')?[path]:[]
    })
    const files=[...scan('app'),...scan('lib')]
    expect(files.filter(path=>readFileSync(path,'utf8').includes('campaign_adopt_provider_receipt'))).toEqual([])
    expect(Object.values(campaignCertificationContracts).every(c=>c.enabled===false)).toBe(true)
  })
})
