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
    preflight: vi.fn(async () => ({ ready: true })),
    execute: vi.fn(async (action, key) => ({ actionKey: key, accountId: action.accountId, provider: action.provider, receiptType: action.expectedReceipt, providerId: 'synthetic-receipt', receivedAt: '2026-10-03T13:00:00Z' })),
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
    const x = setup(); vi.mocked(x.adapter.preflight).mockImplementation(async () => { x.record.state = 'stopped'; return { ready: true } })
    expect((await x.run())[0].status).toBe('blocked'); expect(x.adapter.execute).not.toHaveBeenCalled()
  })
  it('requires reconciliation after a worker crash with a durable claim', async () => {
    const x = setup(), key = actionIdempotencyKey(x.record.manifest.actions[0])
    x.ledger.set(key, { key, state: 'claimed' })
    expect((await x.run())[0].status).toBe('reconciliation_required'); expect(x.adapter.execute).not.toHaveBeenCalled()
  })
  it('rejects mismatched provider receipts', async () => {
    const x = setup(); vi.mocked(x.adapter.execute).mockResolvedValue({ actionKey: 'wrong', accountId: 'wrong', provider: 'linkedin', receiptType: 'platform_post_id', providerId: 'wrong', receivedAt: '2026-10-03T13:00:00Z' })
    expect((await x.run())[0].status).toBe('reconciliation_required')
  })
  it('blocks source, account, and manifest changes before execution', async () => {
    const x = setup(); x.record.manifest.actions[0].accountId = 'changed'
    expect((await x.run())[0].status).toBe('blocked'); expect(x.adapter.execute).not.toHaveBeenCalled()
  })
})
