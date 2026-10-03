// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { CampaignDispatchFence } from './campaign-release-dispatch'
import { hydrateApprovedCampaign } from './campaign-release-activation'
import { DurableCampaignExecutionStore, type CampaignJournalRpc } from './campaign-release-durable-store'
import { CampaignExecutionJournal, attemptFence, emptyExecutionState, type ExecutionState } from './campaign-release-execution'
import { LocalCampaignExecutionStore } from './campaign-release-local-store'
import { decideCampaignRelease, releaseHash, type ReleaseRecord, type CampaignReleaseManifest } from './campaign-release-manifest'
import { fixture } from './campaign-release-test-fixture'
const now = new Date('2026-10-03T13:00:00Z')
class Database implements CampaignJournalRpc {
  state = emptyExecutionState()
  beforeCommit?: () => void
  async rpc(name: string, args?: Record<string, unknown>) {
    if (name === 'campaign_execution_snapshot') return { data: structuredClone(this.state), error: null }
    this.beforeCommit?.(); this.beforeCommit = undefined
    if (args!.expected_version !== this.state.version) return { data: false, error: null }
    this.state = structuredClone(args!.next_state as ExecutionState)
    return { data: true, error: null }
  }
}
async function setup(change?: (manifest: CampaignReleaseManifest) => void) {
  const manifest = fixture(); manifest.spendCapCents = 100; manifest.actions[0].maxSpendCents = 50; change?.(manifest)
  const pending: ReleaseRecord = { manifest, hash: releaseHash(manifest), state: 'pending', version: 1, audit: [] }
  let record = structuredClone(decideCampaignRelease(pending, pending.hash, 'approve', 'portfolio:admin', now))
  const db = new Database(), store = new DurableCampaignExecutionStore(db)
  const source = { read: vi.fn(async () => structuredClone(record)), assertCurrentSources: vi.fn(async () => {}) }
  await hydrateApprovedCampaign({ releaseId: manifest.releaseId, expectedHash: record.hash, expectedVersion: record.version, source, store, now: () => now })
  const protocol = new CampaignDispatchFence(source, store)
  const input = { releaseId: manifest.releaseId, hash: record.hash, approvalVersion: record.version, actionId: manifest.actions[0].id, owner: 'worker', journalVersion: db.state.version, now }
  const decide = (decision: 'hold' | 'revise' | 'stop') => { record = decideCampaignRelease(record, record.hash, decision, 'portfolio:admin', now) }
  return { db, store, source, protocol, input, record, decide }
}
describe('canonical dispatch-intent protocol: no cross-store dispatch permission', () => {
  it('binds authority, source, dependency, owner, budget and CAS; refuses even healthy authority', async () => {
    const x = await setup(), attempt = await x.protocol.prepare(x.input)
    expect(attempt.dispatchIntent).toMatchObject({ status: 'prepared', mode: 'disabled', journalVersion: x.db.state.version, reservedCents: 50, approval: { approvalVersion: 2, auditHash: releaseHash(x.record.audit) } })
    const result = await x.protocol.dispatch(attemptFence(attempt), x.db.state.version, now)
    expect(result).toMatchObject({ dispatched: false, attempt: { state: 'claimed', reservedCents: 50, dispatchIntent: { status: 'refused' } } })
    expect(result.reason).toContain('Cross-store')
    const journal = new CampaignExecutionJournal(x.store)
    await expect(journal.submit(attemptFence(result.attempt), now)).rejects.toThrow('review-only')
    await expect(x.protocol.dispatch(attemptFence(result.attempt), x.db.state.version, now)).rejects.toThrow('consumed')
  })
  it.each(['hold', 'revise', 'stop'] as const)('rejects %s before claim and refuses it immediately before dispatch', async decision => {
    const x = await setup(); x.decide(decision)
    await expect(x.protocol.prepare(x.input)).rejects.toThrow()
    expect(x.db.state.attempts).toEqual({})
    const y = await setup(), attempt = await y.protocol.prepare(y.input); y.decide(decision)
    expect(await y.protocol.dispatch(attemptFence(attempt), y.db.state.version, now)).toMatchObject({ dispatched: false, reason: expect.stringContaining('Canonical authority') })
  })
  it.each(['hold', 'revise', 'stop'] as const)('keeps dispatch disabled when %s races after canonical read or during claim CAS', async decision => {
    const x = await setup(); x.db.beforeCommit = () => x.decide(decision)
    const attempt = await x.protocol.prepare(x.input)
    expect((await x.protocol.dispatch(attemptFence(attempt), x.db.state.version, now)).dispatched).toBe(false)
    const y = await setup(), second = await y.protocol.prepare(y.input)
    y.source.assertCurrentSources.mockImplementation(async () => { y.decide(decision) })
    const result = await y.protocol.dispatch(attemptFence(second), y.db.state.version, now)
    expect(result.dispatched).toBe(false); expect(result.reason).toContain('Cross-store')
  })
  it.each(['hash', 'version', 'audit', 'manifest', 'source', 'expiry', 'evidence', 'journal'] as const)('rejects stale %s at preparation', async kind => {
    const x = await setup()
    if (kind === 'hash') x.input.hash = 'f'.repeat(64)
    if (kind === 'version') x.input.approvalVersion++
    if (kind === 'journal') x.input.journalVersion--
    if (kind === 'audit') x.record.audit[0].actor = 'spoofed'
    if (kind === 'manifest') x.record.manifest.actions[0].copy.body = 'changed'
    if (kind === 'source') x.source.assertCurrentSources.mockRejectedValue(new Error('drift'))
    if (kind === 'expiry') x.input.now = new Date('2026-10-05')
    if (kind === 'evidence') x.record.manifest.actions[0].evidenceExpiresAt = '2026-10-03T12:30:00Z'
    await expect(x.protocol.prepare(x.input)).rejects.toThrow()
    expect(x.db.state.attempts).toEqual({})
  })
  it.each(['source', 'evidence', 'binding', 'budget', 'identity'] as const)('refuses %s drift after intent persistence', async kind => {
    const x = await setup(), attempt = await x.protocol.prepare(x.input)
    if (kind === 'source') x.source.assertCurrentSources.mockRejectedValue(new Error('drift'))
    if (kind === 'evidence') x.record.manifest.actions[0].evidenceExpiresAt = '2026-10-03T12:30:00Z'
    if (kind === 'binding') x.db.state.approvalBindings![x.input.releaseId].approvalVersion++
    if (kind === 'budget') x.db.state.attempts[attempt.deliveryKey].reservedCents--
    if (kind === 'identity') x.db.state.attempts[attempt.deliveryKey].authorizationKey = 'wrong'
    expect((await x.protocol.dispatch(attemptFence(attempt), x.db.state.version, now)).dispatched).toBe(false)
    expect(x.db.state.ledger.filter(e => e.kind === 'release')).toHaveLength(0)
  })
  it('rejects duplicate delivery keys and CAS conflicts without retrying stale intent', async () => {
    const x = await setup(); await x.protocol.prepare(x.input)
    await expect(x.protocol.prepare({ ...x.input, journalVersion: x.db.state.version })).rejects.toThrow('Duplicate')
    const y = await setup(); y.db.beforeCommit = () => { y.db.state.version++ }
    await expect(y.protocol.prepare(y.input)).rejects.toThrow('CAS')
    expect(y.db.state.attempts).toEqual({})
  })
  it('blocks budget exhaustion and missing dependency receipts', async () => {
    const x = await setup()
    x.record.manifest.actions[0].maxSpendCents = 101
    // A changed manifest is rejected before budget use as well.
    await expect(x.protocol.prepare(x.input)).rejects.toThrow()
    const y = await setup(), first = await y.protocol.prepare(y.input)
    y.db.state.attempts[first.deliveryKey].spentCents = 100
    expect((await y.protocol.dispatch(attemptFence(first), y.db.state.version, now)).reason).toContain('budget')
    const z = await setup(), step = await z.protocol.prepare(z.input)
    z.db.state.attempts[step.deliveryKey].dispatchIntent!.dependencyDigest = 'stale-predecessor'
    expect((await z.protocol.dispatch(attemptFence(step), z.db.state.version, now)).reason).toContain('dependency')
  })
  it('rejects lease expiry, takeover and stale journal versions; recovery never enables dispatch', async () => {
    const x = await setup(), attempt = await x.protocol.prepare(x.input), fence = attemptFence(attempt)
    await expect(x.protocol.dispatch(fence, x.db.state.version - 1, now)).rejects.toThrow('CAS')
    const later = new Date(+now + 61_000)
    await expect(x.protocol.dispatch(fence, x.db.state.version, later)).rejects.toThrow('lease')
    const journal = new CampaignExecutionJournal(x.store)
    const recovered = await journal.recover(attempt.deliveryKey, attempt.version, 'replacement', later)
    await expect(x.protocol.dispatch(fence, x.db.state.version, later)).rejects.toThrow('ownership')
    await expect(journal.retry(attemptFence(recovered), later)).rejects.toThrow('review-only')
    expect(recovered.reservedCents).toBe(50)
  })

  it('requires exact predecessor receipts during intent preparation', async () => {
    const x = await setup(manifest => {
      manifest.actions.push({ ...structuredClone(manifest.actions[0]), id: '11111111-1111-4111-8111-000000000005', source: { ...manifest.actions[0].source, id: '11111111-1111-4111-8111-000000000006' }, dependsOn: [manifest.actions[0].id] })
    })
    await expect(x.protocol.prepare({ ...x.input, actionId: x.record.manifest.actions[1].id })).rejects.toThrow('Predecessor')
    expect(x.db.state.attempts).toEqual({})
    const first = await x.protocol.prepare(x.input)
    const before = x.db.state.version
    // Existing committed spend exhausts the release even though this manifest's ceilings fit.
    x.db.state.attempts[first.deliveryKey].spentCents = 100
    const other = { ...structuredClone(first), id: 'prior', deliveryKey: 'previous-key', spentCents: 100 }
    x.db.state.attempts = { 'previous-key': other }
    await expect(x.protocol.prepare({ ...x.input, journalVersion: before })).rejects.toThrow('budget')
  })
  it('does not let legacy synthetic submit bypass a persisted intent if binding is lost', async () => {
    const x = await setup(), attempt = await x.protocol.prepare(x.input)
    delete x.db.state.approvalBindings
    await expect(new CampaignExecutionJournal(x.store).submit(attemptFence(attempt), now)).rejects.toThrow('Canonical dispatch intent')
  })
  it('treats a lost commit response as uncertain and preserves duplicate ownership after restart', async () => {
    const x = await setup(), rpc = x.db.rpc.bind(x.db)
    x.db.rpc = async (name, args) => {
      const result = await rpc(name, args)
      if (name === 'campaign_execution_commit') throw new Error('lost acknowledgement')
      return result
    }
    await expect(x.protocol.prepare(x.input)).rejects.toThrow('uncertain')
    x.db.rpc = rpc
    const persisted = Object.values(x.db.state.attempts)[0]
    expect(persisted.reservedCents).toBe(50)
    const restarted = new CampaignDispatchFence(x.source, new DurableCampaignExecutionStore(x.db))
    await expect(restarted.prepare({ ...x.input, journalVersion: x.db.state.version })).rejects.toThrow('Duplicate')
  })
  it('persists refused intent and ownership across local process reconstruction', async () => {
    const x = await setup(), dir = await mkdtemp(join(tmpdir(), 'campaign-fence-'))
    try {
      const path = join(dir, 'journal.json'), store = new LocalCampaignExecutionStore(path)
      await store.transaction(state => Object.assign(state, structuredClone(x.db.state)))
      const protocol = new CampaignDispatchFence(x.source, store)
      const attempt = await protocol.prepare({ ...x.input, journalVersion: (await store.snapshot()).version })
      const restarted = new CampaignDispatchFence(x.source, new LocalCampaignExecutionStore(path))
      const result = await restarted.dispatch(attemptFence(attempt), (await store.snapshot()).version, now)
      expect(result.dispatched).toBe(false)
      expect((await new LocalCampaignExecutionStore(path).snapshot()).attempts[attempt.deliveryKey].dispatchIntent?.status).toBe('refused')
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
