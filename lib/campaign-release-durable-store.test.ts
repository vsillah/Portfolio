// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DurableCampaignExecutionStore, type CampaignJournalRpc } from './campaign-release-durable-store'
import { CampaignExecutionJournal, attemptFence, emptyExecutionState, type ExecutionState } from './campaign-release-execution'
import { fixture } from './campaign-release-test-fixture'
import { releaseHash } from './campaign-release-manifest'
import { syntheticCampaignReceipt } from './campaign-release-adapters'

// Contract double, not proof of a deployed database. Independent clients share one atomic CAS.
class Database implements CampaignJournalRpc {
  state = emptyExecutionState()
  commits = 0
  loseAcknowledgment = false
  conflict = false
  async rpc(name: string, args?: Record<string, unknown>) {
    if (name === 'campaign_execution_snapshot') return { data: structuredClone(this.state), error: null }
    this.commits++
    if (this.conflict || args!.expected_version !== this.state.version) return { data: false, error: null }
    this.state = structuredClone(args!.next_state as ExecutionState)
    return this.loseAcknowledgment ? { data: null, error: new Error('connection lost after commit') } : { data: true, error: null }
  }
}
const now = new Date('2026-10-03T13:00:00Z')
async function setup() {
  const db = new Database(), worker = () => new CampaignExecutionJournal(new DurableCampaignExecutionStore(db))
  const manifest = fixture(); manifest.actions[0].maxSpendCents = 50; manifest.spendCapCents = 50
  const hash = releaseHash(manifest), a = worker(), b = worker()
  await a.prepare({ manifest, hash, state: 'pending', version: 1, audit: [] })
  await a.decide(manifest.releaseId, hash, 'approve', 'operator', now)
  const input = { releaseId: manifest.releaseId, hash, actionId: manifest.actions[0].id, owner: 'a', now }
  return { db, worker, a, b, manifest, hash, input }
}
describe('distributed journal CAS contract', () => {
  it('classifies thrown transport errors as uncertain without replay', async () => {
    let commits = 0
    const store = new DurableCampaignExecutionStore({ rpc: async name => {
      if (name.endsWith('snapshot')) return { data: emptyExecutionState(), error: null }
      commits++; throw new Error('socket reset')
    } })
    await expect(store.transaction(() => 1)).rejects.toThrow('commit uncertain')
    expect(commits).toBe(1)
  })
  it('gives one worker the delivery identity and one atomic reservation', async () => {
    const x = await setup()
    const results = await Promise.allSettled([x.a.claim(x.input), x.b.claim({ ...x.input, owner: 'b' })])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(Object.values(x.db.state.attempts)).toHaveLength(1)
    expect(x.db.state.ledger).toEqual([expect.objectContaining({ kind: 'reserve', cents: 50 })])
  })
  it('does not replay an uncertain committed submission and survives client restart', async () => {
    const x = await setup(), claim = await x.a.claim(x.input)
    x.db.loseAcknowledgment = true
    const before = x.db.commits
    await expect(x.a.submit(attemptFence(claim), now)).rejects.toThrow('commit uncertain')
    expect(x.db.commits - before).toBe(1)
    x.db.loseAcknowledgment = false
    const restarted = x.worker(), saved = (await restarted.store.snapshot()).attempts[claim.deliveryKey]
    expect(saved.state).toBe('submitted')
    const later = new Date(+now + 61_000)
    const recovered = await restarted.recover(saved.deliveryKey, saved.version, 'b', later)
    expect(recovered.state).toBe('reconciliation_required')
    expect(recovered.reservedCents).toBe(50)
    await expect(x.a.submit(attemptFence(claim), later)).rejects.toThrow('Ownership changed')
    await expect(restarted.retry(attemptFence(recovered), later)).rejects.toThrow('Retry unavailable')
  })
  it('rolls back thrown transitions and detaches snapshots and results', async () => {
    const x = await setup(), before = structuredClone(x.db.state)
    await expect(x.a.store.transaction(s => { s.ledger.length = 0; throw new Error('abort') })).rejects.toThrow('abort')
    expect(x.db.state).toEqual(before)
    const claim = await x.a.claim(x.input); claim.reservedCents = 999
    const snapshot = await x.a.store.snapshot(); snapshot.ledger.length = 0
    expect(x.db.state.ledger).toHaveLength(1)
    expect(x.db.state.attempts[claim.deliveryKey].reservedCents).toBe(50)
  })
  it('bounds contention and refuses malformed commit acknowledgments', async () => {
    const x = await setup(); x.db.conflict = true
    const before = x.db.commits
    await expect(x.a.claim(x.input)).rejects.toThrow('contention limit')
    expect(x.db.commits - before).toBe(5)
    expect(x.db.state.ledger).toHaveLength(0)
    const invalid = new DurableCampaignExecutionStore({ rpc: async name => ({ data: name.endsWith('snapshot') ? emptyExecutionState() : null, error: null }) })
    await expect(invalid.transaction(() => 1)).rejects.toThrow('unconfirmed')
  })
  it('rejects prefix-only receipts and unclassified no-delivery proofs', async () => {
    const x = await setup(), submitted = await x.a.submit(attemptFence(await x.a.claim(x.input)), now)
    const receipt = syntheticCampaignReceipt(x.manifest.actions[0], submitted, now.toISOString())
    delete receipt.trust
    await expect(x.a.reconcile(attemptFence(submitted), { trust: 'synthetic', callbackId: 'c', evidenceId: 'e', outcome: 'confirmed', spentCents: 0, receipt }, now)).rejects.toThrow('does not match')
    await expect(x.a.reconcile(attemptFence(submitted), { trust: undefined as never, callbackId: 'c', evidenceId: 'e', outcome: 'not_delivered', spentCents: 0 }, now)).rejects.toThrow('classification required')
    expect(x.db.state.attempts[submitted.deliveryKey].reservedCents).toBe(50)
  })
  it('serializes duplicate callbacks without duplicate spend', async () => {
    const x = await setup(), submitted = await x.a.submit(attemptFence(await x.a.claim(x.input)), now)
    const evidence = { trust: 'synthetic' as const, callbackId: 'same', evidenceId: 'proof', outcome: 'confirmed' as const, spentCents: 25, receipt: syntheticCampaignReceipt(x.manifest.actions[0], submitted, now.toISOString()) }
    await Promise.all([x.a.reconcile(attemptFence(submitted), evidence, now), x.b.reconcile(attemptFence(submitted), evidence, now)])
    expect(x.db.state.ledger.filter(e => e.kind === 'spend')).toHaveLength(1)
    expect(x.db.state.attempts[submitted.deliveryKey].spentCents).toBe(25)
  })
})
