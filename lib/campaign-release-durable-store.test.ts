// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { DurableCampaignExecutionStore, campaignDatabaseBackend, type CampaignCompareAndSwap } from './campaign-release-durable-store'
import { CampaignExecutionJournal, attemptFence, type ExecutionState } from './campaign-release-execution'
import { fixture } from './campaign-release-test-fixture'
import { releaseHash } from './campaign-release-manifest'
import { syntheticCampaignReceipt } from './campaign-release-adapters'
import { receiptDeliveryEligible, type ReceiptTrust } from './campaign-release-receipts'
const now = new Date('2026-10-03T13:00:00Z')
function backend() {
  let saved: ExecutionState | null = null
  const db: CampaignCompareAndSwap = {
    read: async () => structuredClone(saved),
    commit: async (version, next) => {
      if ((saved?.version ?? null) !== version) return false
      saved = structuredClone(next); return true
    },
  }
  return db
}
async function setup() {
  const db = backend(), worker = () => new CampaignExecutionJournal(new DurableCampaignExecutionStore(db))
  const manifest = fixture(); manifest.spendCapCents = 50; manifest.actions[0].maxSpendCents = 50
  const hash = releaseHash(manifest), journal = worker()
  await journal.prepare({ manifest, hash, state: 'pending', version: 1, audit: [] })
  await journal.decide(manifest.releaseId, hash, 'approve', 'synthetic-admin', now)
  const input = { releaseId: manifest.releaseId, hash, actionId: manifest.actions[0].id, owner: 'worker', now }
  return { db, worker, journal, manifest, hash, input }
}
describe('distributed journal contract', () => {
  it('serializes separate workers and duplicate delivery into one reservation', async () => {
    const x = await setup()
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => x.worker().claim({ ...x.input, owner: `worker-${i}` })))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const state = await x.worker().store.snapshot()
    expect(state.ledger).toHaveLength(1); expect(state.ledger[0].cents).toBe(50)
    expect(Object.keys(state.attempts)).toHaveLength(1)
  })
  it('restarts after submit, retains reservations and rejects stale-owner completion and retry', async () => {
    const x = await setup(), claim = await x.journal.claim(x.input)
    const submitted = await x.journal.submit(attemptFence(claim), now), later = new Date(+now + 61000)
    const recovered = await x.worker().recover(claim.deliveryKey, submitted.version, 'replacement', later)
    expect(recovered.state).toBe('reconciliation_required'); expect(recovered.reservedCents).toBe(50)
    await expect(x.worker().retry(attemptFence(recovered), later)).rejects.toThrow('Retry unavailable')
    await expect(x.worker().reconcile(attemptFence(submitted), { mode: 'synthetic' as const, callbackId: 'stale', evidenceId: 'synthetic', outcome: 'uncertain', spentCents: 0 }, later)).rejects.toThrow('Ownership changed')
  })
  it('rejects provider trust promotion and unqualified predecessor receipts', async () => {
    const x = await setup(), a = await x.journal.submit(attemptFence(await x.journal.claim(x.input)), now)
    for (const trust of ['locally_verified', 'provider_accepted', 'provider_confirmed', 'rejected', 'uncertain', undefined] as const) {
      await expect(x.journal.reconcile(attemptFence(a), { mode: 'synthetic' as const, callbackId: 'callback', evidenceId: 'proof', outcome: 'confirmed', spentCents: 0, receipt: { ...syntheticCampaignReceipt(x.manifest.actions[0], a, now.toISOString()), trust } }, now)).rejects.toThrow('does not match')
    }
    expect((await x.worker().store.snapshot()).attempts[a.deliveryKey].reservedCents).toBe(50)
  })
  it('deduplicates concurrent callback redelivery across fresh workers', async () => {
    const x = await setup(), a = await x.journal.submit(attemptFence(await x.journal.claim(x.input)), now)
    const proof = { mode: 'synthetic' as const, callbackId: 'same', evidenceId: 'synthetic', outcome: 'confirmed' as const, spentCents: 20, receipt: syntheticCampaignReceipt(x.manifest.actions[0], a, now.toISOString()) }
    const results = await Promise.all([x.worker().reconcile(attemptFence(a), proof, now), x.worker().reconcile(attemptFence(a), proof, now)])
    expect(results[0]).toEqual(results[1])
    expect((await x.worker().store.snapshot()).ledger.filter(e => e.kind === 'spend')).toHaveLength(1)
  })
  it('does not replay an uncertain commit, but restart recovers the persisted barrier', async () => {
    const x = await setup(); let writes = 0
    const uncertain = new DurableCampaignExecutionStore({ read: x.db.read, commit: async (v, s) => { writes++; await x.db.commit(v, s); throw new Error('lost response') } })
    await expect(new CampaignExecutionJournal(uncertain).claim(x.input)).rejects.toThrow('lost response')
    expect(writes).toBe(1)
    await expect(x.worker().claim(x.input)).rejects.toThrow('already claimed')
  })
  it('rolls back thrown transitions and bounds definite conflict retries', async () => {
    const x = await setup(), before = await x.db.read()
    await expect(x.journal.store.transaction(s => { s.releases = {}; throw new Error('abort') })).rejects.toThrow('abort')
    expect(await x.db.read()).toEqual(before)
    let conflicts = 0
    const store = new DurableCampaignExecutionStore({ read: x.db.read, commit: async () => { conflicts++; return false } })
    await expect(store.transaction(() => 1)).rejects.toThrow('contention')
    expect(conflicts).toBe(8)
  })
  it('keeps all receipt levels ineligible for live execution', () => {
    for (const trust of ['synthetic', 'locally_verified', 'provider_accepted', 'provider_confirmed', 'rejected', 'uncertain'] as ReceiptTrust[]) expect(receiptDeliveryEligible(trust)).toBe(false)
  })
  it('uses SDK filters on identity, kind and prior version, returning only committed rows', async () => {
    const requests: { url: string; method: string; body: string }[] = []
    const client = createClient('http://synthetic.invalid', 'synthetic-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
      requests.push({ url: String(url), method: init?.method ?? 'GET', body: String(init?.body ?? '') })
      return new Response(JSON.stringify([{ id: 'journal' }]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    } } })
    const x = await setup(), state = (await x.db.read())!
    expect(await campaignDatabaseBackend(client).commit(2, state)).toBe(true)
    const request = requests[0], url = new URL(request.url)
    expect(request.method).toBe('PATCH'); expect(url.searchParams.get('metadata->>version')).toBe('eq.2')
    expect(url.searchParams.get('kind')).toBe('eq.campaign_execution_journal')
    expect(url.searchParams.get('id')).toContain('caca0003'); expect(JSON.parse(request.body).metadata).toEqual(state)
  })
})

it('atomically enforces the shared budget across competing actions', async () => {
  const db = backend(), journal = new CampaignExecutionJournal(new DurableCampaignExecutionStore(db)), manifest = fixture()
  manifest.spendCapCents = 100; manifest.actions[0].maxSpendCents = 50
  manifest.actions.push({ ...structuredClone(manifest.actions[0]), id: '11111111-1111-4111-8111-000000000005', source: { ...manifest.actions[0].source, id: '11111111-1111-4111-8111-000000000006' } })
  const hash = releaseHash(manifest)
  await journal.prepare({ manifest, hash, state: 'pending', version: 1, audit: [] })
  await journal.decide(manifest.releaseId, hash, 'approve', 'admin', now)
  const results = await Promise.allSettled(manifest.actions.map(action => new CampaignExecutionJournal(new DurableCampaignExecutionStore(db)).claim({ releaseId: manifest.releaseId, hash, actionId: action.id, owner: action.id, now })))
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2)
  const state = await journal.store.snapshot()
  expect(state.ledger).toHaveLength(2)
  expect(Object.values(state.attempts).reduce((sum, a) => sum + a.reservedCents, 0)).toBe(100)
})

it('preserves no-dispatch retry and stop authority through fresh workers', async () => {
  const x = await setup(), a = await x.journal.claim(x.input), later = new Date(+now + 61000)
  const recovered = await x.worker().recover(a.deliveryKey, a.version, 'new', later)
  const retry = await x.worker().retry(attemptFence(recovered), later)
  expect(retry.tryCount).toBe(2)
  expect((await x.worker().store.snapshot()).ledger).toHaveLength(1)
  await x.worker().decide(x.manifest.releaseId, x.hash, 'stop', 'admin', later)
  await expect(x.worker().submit(attemptFence(retry), later)).rejects.toThrow()
  expect((await x.worker().store.snapshot()).releases[x.manifest.releaseId].state).toBe('stopped')
})

it('requires explicit simulation scope even for no-delivery reconciliation', async () => {
  const x = await setup(), a = await x.journal.submit(attemptFence(await x.journal.claim(x.input)), now)
  // Older/raw callback payloads cannot silently become verification authority.
  await expect(x.journal.reconcile(attemptFence(a), { callbackId: 'raw', evidenceId: 'asserted', outcome: 'not_delivered', spentCents: 0 } as never, now)).rejects.toThrow('explicit synthetic')
  expect((await x.worker().store.snapshot()).attempts[a.deliveryKey].state).toBe('submitted')
})
