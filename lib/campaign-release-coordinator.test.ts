import { describe, it, expect, vi } from 'vitest'
import { coordinateCampaignRelease, type ActionExecution, type CampaignExecutionAdapter, type CampaignExecutionStore } from './campaign-release-coordinator'
import { fixture } from './campaign-release-test-fixture'
import { actionIdempotencyKey, releaseHash, type ReleaseRecord } from './campaign-release-manifest'

function setup() {
  const manifest = fixture()
  const record: ReleaseRecord = { manifest, hash: releaseHash(manifest), state: 'approved', version: 2, audit: [] }
  const ledger = new Map<string, ActionExecution>()
  const store: CampaignExecutionStore = {
    release: async () => record,
    claim: async key => { if (ledger.has(key)) return false; ledger.set(key, { key, state: 'claimed' }); return true },
    action: async key => ledger.get(key) ?? null,
    settle: async entry => { ledger.set(entry.key, entry) },
  }
  const adapter: CampaignExecutionAdapter = {
    preflight: vi.fn(async () => ({ ready: true, providerGateSatisfied: true, consentAndSuppressionCurrent: true, reservedSpendCents: 0 })),
    execute: vi.fn(async (action, key) => ({ contentHash: releaseHash({ copy: action.copy, assets: action.assets }), actionKey: key, accountId: action.accountId, provider: action.provider, receiptType: action.expectedReceipt, trust: 'synthetic' as const, providerId: 'synthetic:receipt', receivedAt: '2026-10-03T13:00:00Z' })),
  }
  const run = (adapters = { linkedin: adapter }) => coordinateCampaignRelease({ releaseId: manifest.releaseId, expectedHash: record.hash, store, adapters, now: () => new Date('2026-10-03T13:00:00Z') })
  return { record, ledger, store, adapter, run }
}
describe('campaign coordinator synthetic contract', () => {
  it('blocks production execution by default when no certified adapter exists', async () => {
    const x = setup(); const results = await x.run({} as never)
    expect(results[0].status).toBe('blocked'); expect(x.ledger.size).toBe(0)
  })
  it('allows only one concurrent dispatch and never resends a confirmed action', async () => {
    const x = setup(); await Promise.all([x.run(), x.run()]); await x.run()
    expect(x.adapter.execute).toHaveBeenCalledTimes(1)
    expect((await x.run())[0].status).toBe('confirmed')
  })
  it('stops after ambiguous provider error and retains the claim on retry', async () => {
    const x = setup(); vi.mocked(x.adapter.execute).mockRejectedValue(new Error('Timeout after submission'))
    expect((await x.run())[0].status).toBe('reconciliation_required')
    await x.run(); expect(x.adapter.execute).toHaveBeenCalledTimes(1)
  })
  it('blocks after emergency stop during preflight', async () => {
    const x = setup(); vi.mocked(x.adapter.preflight).mockImplementation(async () => { x.record.state = 'stopped'; return { ready: true, providerGateSatisfied: true, consentAndSuppressionCurrent: true, reservedSpendCents: 0 } })
    expect((await x.run())[0].status).toBe('blocked'); expect(x.adapter.execute).not.toHaveBeenCalled()
  })
  it('requires reconciliation after a worker crash with a durable claim', async () => {
    const x = setup(), key = actionIdempotencyKey(x.record.manifest.actions[0])
    x.ledger.set(key, { key, state: 'claimed' })
    expect((await x.run())[0].status).toBe('reconciliation_required'); expect(x.adapter.execute).not.toHaveBeenCalled()
  })
  it('rejects mismatched provider receipts', async () => {
    const x = setup(); vi.mocked(x.adapter.execute).mockResolvedValue({ contentHash: 'wrong', actionKey: 'wrong', accountId: 'wrong', provider: 'linkedin', receiptType: 'platform_post_id', providerId: 'wrong', receivedAt: '2026-10-03T13:00:00Z' })
    expect((await x.run())[0].status).toBe('reconciliation_required')
  })
  it('blocks source, account, and manifest changes before execution', async () => {
    const x = setup(); x.record.manifest.actions[0].accountId = 'changed'
    expect((await x.run())[0].status).toBe('blocked'); expect(x.adapter.execute).not.toHaveBeenCalled()
  })
})

describe('reconciled execution gates', () => {
  it.each(['confirmed', 'reconciliation_required', 'claimed'] as const)('never replays %s delivery under a new revision/action UUID', async state => {
    const x = setup(); await x.run()
    const key = actionIdempotencyKey(x.record.manifest.actions[0])
    x.ledger.get(key)!.state = state
    x.record.manifest.revision++
    x.record.manifest.releaseId = '11111111-1111-4111-8111-000000000090'
    x.record.manifest.actions[0].id = '11111111-1111-4111-8111-000000000091'
    x.record.manifest.actions[0].copy.body = 'Repackaged copy'
    x.record.hash = releaseHash(x.record.manifest)
    expect((await x.run())[0].status).toBe('reconciliation_required')
    expect(x.adapter.execute).toHaveBeenCalledTimes(1)
  })
  it('rejects evidence expiry without claiming or calling a provider', async () => {
    const x = setup(); x.record.manifest.actions[0].evidenceExpiresAt = '2026-10-03T12:30:00Z'
    x.record.hash = releaseHash(x.record.manifest)
    expect((await x.run())[0].reason).toContain('expired'); expect(x.ledger.size).toBe(0)
    expect(x.adapter.execute).not.toHaveBeenCalled()
  })
  it.each(['providerGateSatisfied', 'consentAndSuppressionCurrent'] as const)('fails closed when %s is false despite adapter readiness', async field => {
    const x = setup()
    vi.mocked(x.adapter.preflight).mockResolvedValue({ ready: true, providerGateSatisfied: true, consentAndSuppressionCurrent: true, reservedSpendCents: 0, [field]: false })
    expect((await x.run())[0].status).toBe('blocked'); expect(x.ledger.size).toBe(0)
  })
  it.each([1, -1, NaN, 0.5])('blocks invalid or excessive reserved spending %s', async reservedSpendCents => {
    const x = setup()
    vi.mocked(x.adapter.preflight).mockResolvedValue({ ready: true, providerGateSatisfied: true, consentAndSuppressionCurrent: true, reservedSpendCents })
    expect((await x.run())[0].reason).toContain('Spending cap'); expect(x.ledger.size).toBe(0)
  })
  it('binds atomic budget claim and dispatch to the same exact authority and immutable input', async () => {
    const x = setup(); const claim = vi.spyOn(x.store, 'claim')
    await x.run()
    const authority = claim.mock.calls[0][1]
    expect(authority).toMatchObject({ manifestHash: x.record.hash, maxSpendCents: 0, spendCapCents: 0 })
    expect(authority.authorizationKey).toMatch(/^campaign-authorization:/)
    expect(x.adapter.execute).toHaveBeenCalledWith(expect.anything(), claim.mock.calls[0][0], authority)
    expect(Object.isFrozen(vi.mocked(x.adapter.execute).mock.calls[0][0].copy)).toBe(true)
  })
  it('waits for a matching dependency receipt, then dispatches the dependent action once', async () => {
    const x = setup(), first = x.record.manifest.actions[0]
    const second = { ...structuredClone(first), id: '11111111-1111-4111-8111-000000000080',
      source: { ...first.source, id: '11111111-1111-4111-8111-000000000081' }, dependsOn: [first.id] }
    x.record.manifest.actions = [second, first]; x.record.hash = releaseHash(x.record.manifest)
    expect((await x.run()).map(result => result.status)).toEqual(['waiting', 'confirmed'])
    expect((await x.run()).map(result => result.status)).toEqual(['confirmed', 'confirmed'])
    expect(x.adapter.execute).toHaveBeenCalledTimes(2)
  })
  it('never unblocks a dependency with an uncertain or mismatched receipt', async () => {
    const x = setup(), first = x.record.manifest.actions[0], key = actionIdempotencyKey(first)
    x.record.manifest.actions.push({ ...structuredClone(first), id: '11111111-1111-4111-8111-000000000080',
      source: { ...first.source, id: '11111111-1111-4111-8111-000000000081' }, dependsOn: [first.id] })
    x.record.hash = releaseHash(x.record.manifest)
    x.ledger.set(key, { key, state: 'reconciliation_required' })
    expect((await x.run()).map(result => result.status)).toEqual(['reconciliation_required', 'waiting'])
    expect(x.adapter.execute).not.toHaveBeenCalled()
  })
  it('blocks changes during preflight and invalid clocks', async () => {
    const x = setup()
    vi.mocked(x.adapter.preflight).mockImplementation(async () => {
      x.record.manifest.actions[0].copy.body = 'Changed after approval'
      return { ready: true, providerGateSatisfied: true, consentAndSuppressionCurrent: true, reservedSpendCents: 0 }
    })
    expect((await x.run())[0].status).toBe('blocked'); expect(x.ledger.size).toBe(0)
    const y = setup()
    expect((await coordinateCampaignRelease({ releaseId: y.record.manifest.releaseId, expectedHash: y.record.hash, store: y.store, now: () => new Date('invalid') }))[0].status).toBe('blocked')
  })
})

describe('authority at final dispatch', () => {
  it('does not dispatch after stop during the atomic claim', async () => {
    const x = setup(), claim = x.store.claim
    x.store.claim = async (key, authority) => { const result = await claim(key, authority); x.record.state = 'stopped'; return result }
    expect((await x.run())[0].status).toBe('reconciliation_required')
    expect(x.adapter.execute).not.toHaveBeenCalled(); expect(x.ledger.size).toBe(1)
  })
  it('blocks evidence that expires during preflight', async () => {
    const x = setup(); let tick = '2026-10-03T13:00:00Z'
    x.record.manifest.actions[0].evidenceExpiresAt = '2026-10-03T14:00:00Z'; x.record.hash = releaseHash(x.record.manifest)
    vi.mocked(x.adapter.preflight).mockImplementation(async () => {
      tick = '2026-10-03T14:00:00Z'
      return { ready: true, providerGateSatisfied: true, consentAndSuppressionCurrent: true, reservedSpendCents: 0 }
    })
    const results = await coordinateCampaignRelease({ releaseId: x.record.manifest.releaseId, expectedHash: x.record.hash, store: x.store, adapters: { linkedin: x.adapter }, now: () => new Date(tick) })
    expect(results[0].status).toBe('blocked'); expect(x.ledger.size).toBe(0)
  })
  it('does not accept the receipt for older copy as proof of a revised predecessor', async () => {
    const x = setup(); await x.run()
    const first = x.record.manifest.actions[0]; first.copy.body = 'Revised predecessor'
    x.record.manifest.actions.push({ ...structuredClone(first), id: '11111111-1111-4111-8111-000000000080',
      source: { ...first.source, id: '11111111-1111-4111-8111-000000000081' }, dependsOn: [first.id] })
    x.record.hash = releaseHash(x.record.manifest)
    expect((await x.run()).map(result => result.status)).toEqual(['reconciliation_required', 'waiting'])
    expect(x.adapter.execute).toHaveBeenCalledTimes(1)
  })
})

describe('bounded execution windows and budget reservation', () => {
  it.each([
    ['2026-10-03T11:00:00Z', 'waiting'],
    ['2026-10-04T00:00:00Z', 'blocked'],
  ])('does not execute at %s', async (time, status) => {
    const x = setup()
    const result = await coordinateCampaignRelease({ releaseId: x.record.manifest.releaseId, expectedHash: x.record.hash, store: x.store, adapters: { linkedin: x.adapter }, now: () => new Date(time) })
    expect(result[0].status).toBe(status); expect(x.ledger.size).toBe(0)
  })
  it('fails closed when the atomic budget reservation is refused after preflight', async () => {
    const x = setup(); x.record.manifest.spendCapCents = 100; x.record.manifest.actions[0].maxSpendCents = 100
    x.record.hash = releaseHash(x.record.manifest)
    x.store.claim = vi.fn(async () => false)
    expect((await x.run())[0].status).toBe('reconciliation_required')
    expect(x.store.claim).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ maxSpendCents: 100, spendCapCents: 100 }))
    expect(x.adapter.execute).not.toHaveBeenCalled()
  })
})
