// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { fixture } from './campaign-release-test-fixture'
import { decideCampaignRelease, releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import { hydrateApprovedCampaign } from './campaign-release-activation'
import { DurableCampaignExecutionStore, type CampaignJournalRpc } from './campaign-release-durable-store'
import { CampaignExecutionJournal, attemptFence, campaignReceiptContext, emptyExecutionState, type ExecutionState } from './campaign-release-execution'
import { receiptDeliveryEligible, sandboxReceiptVerifier, type ReceiptTrust, type SandboxCallback, type VerifiedCampaignReceipt } from './campaign-release-receipts'
import { registerCampaignProductionWorker } from './campaign-release-adapters'

const now = new Date('2026-10-03T13:00:00Z')
class Database implements CampaignJournalRpc {
  state = emptyExecutionState()
  async rpc(name: string, args?: Record<string, unknown>) {
    if (name === 'campaign_execution_snapshot') return { data: structuredClone(this.state), error: null }
    if (args!.expected_version !== this.state.version) return { data: false, error: null }
    this.state = structuredClone(args!.next_state as ExecutionState)
    return { data: true, error: null }
  }
}
function canonical() {
  const manifest = fixture()
  const pending: ReleaseRecord = { manifest, hash: releaseHash(manifest), state: 'pending', version: 1, audit: [] }
  return decideCampaignRelease(pending, pending.hash, 'approve', 'portfolio:authenticated-admin', now)
}
function activation() {
  const record = canonical(), db = new Database(), store = new DurableCampaignExecutionStore(db)
  const source = { read: vi.fn(async () => structuredClone(record)), assertCurrentSources: vi.fn(async () => {}) }
  const input = { releaseId: record.manifest.releaseId, expectedHash: record.hash, expectedVersion: record.version, source, store, now: () => now }
  return { record, db, store, source, input }
}
describe('canonical approval hydration over RPC CAS', () => {
  it('binds exact audit/hash/version, supports replay, and forbids bound decisions/claims', async () => {
    const x = activation(), first = await hydrateApprovedCampaign(x.input)
    expect(await hydrateApprovedCampaign(x.input)).toEqual(first)
    expect(first).toMatchObject({ approvalVersion: 2, auditHash: releaseHash(x.record.audit), status: 'bound', executionEnabled: false })
    const journal = new CampaignExecutionJournal(x.store)
    await expect(journal.decide(first.releaseId, first.manifestHash, 'approve', 'portfolio:admin', now)).rejects.toThrow('canonical decision API')
    await expect(journal.claim({ releaseId: first.releaseId, hash: first.manifestHash, actionId: x.record.manifest.actions[0].id, owner: 'worker', now })).rejects.toThrow('Worker registration disabled')
    expect(x.db.state.attempts).toEqual({})
  })
  it.each(['pending', 'held', 'revision_requested', 'stopped'] as const)('rejects %s authority before persistence', async state => {
    const x = activation(); x.record.state = state
    await expect(hydrateApprovedCampaign(x.input)).rejects.toThrow()
    expect(x.db.state.version).toBe(0)
  })
  it.each(['hash', 'version', 'audit', 'actor', 'expired', 'sources', 'identity'] as const)('rejects stale or untrusted %s', async kind => {
    const x = activation()
    if (kind === 'hash') x.input.expectedHash = 'b'.repeat(64)
    if (kind === 'version') x.input.expectedVersion++
    if (kind === 'audit') x.record.audit = []
    if (kind === 'actor') x.record.audit[0].actor = 'browser-controlled'
    if (kind === 'expired') x.input.now = () => new Date('2026-10-05T00:00:00Z')
    if (kind === 'sources') x.source.assertCurrentSources.mockRejectedValue(new Error('Source changed'))
    if (kind === 'identity') x.input.releaseId = 'wrong'
    await expect(hydrateApprovedCampaign(x.input)).rejects.toThrow()
    expect(x.db.state.version).toBe(0)
  })
  it('invalidates a stop racing hydration without opening a worker path', async () => {
    const x = activation()
    x.source.read.mockResolvedValueOnce(structuredClone(x.record)).mockResolvedValueOnce(decideCampaignRelease(x.record, x.record.hash, 'stop', 'portfolio:admin', now))
    await expect(hydrateApprovedCampaign(x.input)).rejects.toThrow()
    expect(x.db.state.approvalBindings![x.input.releaseId].status).toBe('invalidated')
    expect(x.db.state.attempts).toEqual({})
  })
  it('uses Slack canonical audit authority without sending Slack or trusting its button payload', async () => {
    const x = activation(); x.record.audit[0].actor = 'slack:authenticated-admin'
    expect((await hydrateApprovedCampaign(x.input)).auditHash).toBe(releaseHash(x.record.audit))
    x.record.audit[0].hash = 'f'.repeat(64)
    await expect(hydrateApprovedCampaign(x.input)).rejects.toThrow()
  })
})
async function execution() {
  const record = canonical(), manifest = structuredClone(record.manifest)
  manifest.spendCapCents = 100; manifest.actions[0].maxSpendCents = 50
  manifest.actions.push({ ...structuredClone(manifest.actions[0]), id: '11111111-1111-4111-8111-000000000005', source: { ...manifest.actions[0].source, id: '11111111-1111-4111-8111-000000000006' }, dependsOn: [manifest.actions[0].id] })
  const db = new Database(), store = new DurableCampaignExecutionStore(db), journal = new CampaignExecutionJournal(store), hash = releaseHash(manifest)
  await journal.prepare({ manifest, hash, state: 'pending', version: 1, audit: [] })
  await journal.decide(manifest.releaseId, hash, 'approve', 'synthetic-operator', now)
  const claim = (actionId = manifest.actions[0].id) => journal.claim({ releaseId: manifest.releaseId, hash, actionId, owner: 'sandbox', now })
  const attempt = await journal.submit(attemptFence(await claim()), now)
  const event = (trust: ReceiptTrust, callbackId: string = trust): SandboxCallback => ({ ...campaignReceiptContext(db.state, db.state.attempts[attempt.deliveryKey]), callbackId, evidenceId: 'sandbox-evidence', trust, providerId: 'sandbox:receipt', receivedAt: now.toISOString(), spentCents: trust === 'provider_confirmed' ? 25 : 0 })
  const verify = (callback: SandboxCallback) => sandboxReceiptVerifier([callback]).verify(callback, campaignReceiptContext(db.state, db.state.attempts[attempt.deliveryKey]))
  return { db, store, journal, manifest, claim, attempt, event, verify }
}
describe('sandbox receipt trust state machine', () => {
  it.each(['synthetic', 'locally_verified', 'provider_accepted', 'provider_confirmed', 'rejected', 'uncertain'] as const)('classifies %s without production eligibility', async trust => {
    const x = await execution(), result = await x.journal.reconcileVerified(attemptFence(x.attempt), x.verify(x.event(trust)), now)
    expect(receiptDeliveryEligible(trust)).toBe(false)
    expect(result.state).toBe(['synthetic', 'provider_confirmed'].includes(trust) ? 'confirmed' : trust === 'rejected' ? 'retryable' : 'reconciliation_required')
    expect(result.reservedCents).toBe(['locally_verified', 'provider_accepted', 'uncertain'].includes(trust) ? 50 : 0)
  })
  it('acceptance keeps dependency blocked; confirmation releases it; duplicate callback does not spend twice', async () => {
    const x = await execution()
    const accepted = await x.journal.reconcileVerified(attemptFence(x.attempt), x.verify(x.event('provider_accepted')), now)
    await expect(x.claim(x.manifest.actions[1].id)).rejects.toThrow('Dependency')
    const proof = x.verify(x.event('provider_confirmed'))
    const confirmed = await x.journal.reconcileVerified(attemptFence(accepted), proof, now)
    expect((await x.journal.reconcileVerified(attemptFence(accepted), proof, now)).version).toBe(confirmed.version)
    expect(x.db.state.ledger.filter(e => e.kind === 'spend')).toHaveLength(1)
    const second = await x.journal.submit(attemptFence(await x.claim(x.manifest.actions[1].id)), now)
    const context = campaignReceiptContext(x.db.state, second)
    expect(Object.values(context.predecessors)).toEqual([releaseHash(confirmed.receipt)])
    const callback: SandboxCallback = { ...x.event('provider_confirmed'), ...context, callbackId: 'second' }
    const verified = sandboxReceiptVerifier([callback]).verify(callback, context)
    x.db.state.attempts[confirmed.deliveryKey].receipt!.accountId = 'wrong'
    await expect(x.journal.reconcileVerified(attemptFence(second), verified, now)).rejects.toThrow('Predecessor')
  })
  it.each(['callbackId', 'accountId', 'contentHash', 'actionKey', 'receiptType', 'provider', 'predecessors', 'tryCount', 'attemptId', 'manifestHash'] as const)('rejects mismatched %s and forged proof objects', async field => {
    const x = await execution(), event = x.event('provider_confirmed'), context = campaignReceiptContext(x.db.state, x.attempt)
    const changed = { ...event, [field]: field === 'predecessors' ? { wrong: 'digest' } : field === 'tryCount' ? 99 : 'wrong' }
    const verifier = sandboxReceiptVerifier([event])
    expect(() => verifier.verify(changed, context)).toThrow('Untrusted')
    if (field !== 'callbackId') expect(() => sandboxReceiptVerifier([changed as SandboxCallback]).verify(changed, context)).toThrow('mismatch')
    const proof = verifier.verify(event, context)
    await expect(x.journal.reconcileVerified(attemptFence(x.attempt), { ...proof } as VerifiedCampaignReceipt, now)).rejects.toThrow('Verifier-owned')
  })
  it('rejects conflicting callback identities and old-attempt proofs after no-delivery retry', async () => {
    const x = await execution(), old = x.verify(x.event('provider_confirmed', 'old-proof'))
    const uncertain = await x.journal.reconcileVerified(attemptFence(x.attempt), x.verify(x.event('uncertain', 'same')), now)
    await expect(x.journal.retry(attemptFence(uncertain), now)).rejects.toThrow('Retry unavailable')
    await expect(x.journal.reconcileVerified(attemptFence(uncertain), x.verify(x.event('rejected', 'same')), now)).rejects.toThrow('Conflicting')
    const rejected = await x.journal.reconcileVerified(attemptFence(uncertain), x.verify(x.event('rejected')), now)
    const retry = await x.journal.submit(attemptFence(await x.journal.retry(attemptFence(rejected), now)), now)
    await expect(x.journal.reconcileVerified(attemptFence(retry), old, now)).rejects.toThrow('exact-context')
  })
  it('rejects provider resource replacement and receipts predating submission', async () => {
    const x = await execution()
    const stale = { ...x.event('provider_confirmed'), receivedAt: new Date(+now - 1000).toISOString() }
    await expect(x.journal.reconcileVerified(attemptFence(x.attempt), x.verify(stale), now)).rejects.toThrow('predates')
    const accepted = await x.journal.reconcileVerified(attemptFence(x.attempt), x.verify(x.event('provider_accepted')), now)
    const replaced = { ...x.event('provider_confirmed'), providerId: 'sandbox:another-resource' }
    await expect(x.journal.reconcileVerified(attemptFence(accepted), x.verify(replaced), now)).rejects.toThrow('resource identity')
    await expect(x.journal.reconcile(attemptFence(accepted), { trust: 'synthetic', callbackId: 'bypass', evidenceId: 'bypass', outcome: 'not_delivered', spentCents: 0 }, now)).rejects.toThrow('verified reconciliation')
  })
  it('keeps registration disabled even when activation-looking env values exist', () => {
    vi.stubEnv('CAMPAIGN_EXECUTION_ENABLED', 'true')
    try { expect(() => registerCampaignProductionWorker()).toThrow('disabled') } finally { vi.unstubAllEnvs() }
  })
})
