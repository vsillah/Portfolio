import { describe, it, expect } from 'vitest'
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CampaignReleaseFileStore } from './campaign-release-file-store'
import { claimSimulation, settleSimulation, saveSimulationRelease, reconcileSimulation, simulationBudget, simulationRetry, disabledCampaignAdapters } from './campaign-release-simulation'
import { campaignActionKeys, releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import { campaignReleaseProgress } from './campaign-release-progress'
import { fixture } from './campaign-release-test-fixture'
const now = new Date('2026-10-03T13:00:00Z')
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'campaign-test-')), store = new CampaignReleaseFileStore(dir)
  const manifest = fixture(); manifest.spendCapCents = 100; manifest.actions[0].maxSpendCents = 100
  const record: ReleaseRecord = { manifest, hash: releaseHash(manifest), state: 'approved', version: 2, audit: [] }
  await saveSimulationRelease(store, record)
  const claim = () => claimSimulation({ store, releaseId: manifest.releaseId, hash: record.hash, actionId: manifest.actions[0].id, now })
  return { dir, store, record, claim, cleanup: () => rm(dir, { recursive: true, force: true }) }
}
describe('durable synthetic campaign execution', () => {
  it('persists a claim across restart and denies duplicates and stale owners', async () => {
    const s = await setup()
    try {
      const claim = await s.claim(), restarted = new CampaignReleaseFileStore(s.dir)
      await expect(claimSimulation({ store: restarted, releaseId: s.record.manifest.releaseId, hash: s.record.hash, actionId: s.record.manifest.actions[0].id, now })).rejects.toThrow('already claimed')
      await expect(settleSimulation({ store: restarted, claim: { ...claim, owner: 'stale' }, outcome: { kind: 'confirmed', spentCents: 1 }, now })).rejects.toThrow('Stale')
      await settleSimulation({ store: restarted, claim, outcome: { kind: 'confirmed', spentCents: 40 }, now })
      await expect(settleSimulation({ store: restarted, claim, outcome: { kind: 'confirmed', spentCents: 40 }, now })).rejects.toThrow('Stale')
      const state = JSON.parse(await readFile(join(s.dir, 'state.json'), 'utf8'))
      expect(simulationBudget(state, s.record.manifest.releaseId)).toEqual({ reservedCents: 0, spentCents: 40 })
      expect(campaignReleaseProgress(state, s.record).actions[0].receiptId).toMatch(/^synthetic:/)
      expect(JSON.stringify(campaignReleaseProgress(state, s.record))).not.toContain(claim.owner)
    } finally { await s.cleanup() }
  })
  it('retains uncertain budget and reconciles an exact receipt without dispatch', async () => {
    const s = await setup()
    try {
      const claim = await s.claim()
      const attempt = await settleSimulation({ store: s.store, claim, outcome: { kind: 'uncertain' }, now })
      expect(simulationRetry(attempt)).toBe('reconcile'); expect(attempt.reservedCents).toBe(100)
      await expect(s.claim()).rejects.toThrow('already claimed')
      const action = s.record.manifest.actions[0]
      const receipt = { provider: action.provider, accountId: action.accountId, actionKey: claim.key, contentHash: campaignActionKeys(s.record.manifest, action.id).contentHash, receiptType: action.expectedReceipt, providerId: 'synthetic:recovered', receivedAt: now.toISOString() }
      const input = { store: s.store, key: claim.key, version: attempt.version, receipt, spentCents: 50, evidence: 'synthetic lookup', now }
      await expect(reconcileSimulation({ ...input, receipt: { ...receipt, accountId: 'wrong' } })).rejects.toThrow('evidence')
      await expect(reconcileSimulation({ ...input, spentCents: 101 })).rejects.toThrow('spending')
      expect((await reconcileSimulation(input)).state).toBe('confirmed')
      await expect(reconcileSimulation(input)).rejects.toThrow('version')
    } finally { await s.cleanup() }
  })
  it('permits retry only after definite no-dispatch and fences the old attempt', async () => {
    const s = await setup()
    try {
      const first = await s.claim()
      const attempt = await settleSimulation({ store: s.store, claim: first, outcome: { kind: 'not_dispatched' }, now })
      expect(simulationRetry(attempt)).toBe('retry_safe')
      const second = await s.claim(); expect(second.id).not.toBe(first.id)
      await expect(settleSimulation({ store: s.store, claim: first, outcome: { kind: 'confirmed', spentCents: 0 }, now })).rejects.toThrow('Stale')
    } finally { await s.cleanup() }
  })
  it('allows only one concurrent worker and fails closed on orphan locks', async () => {
    const s = await setup()
    try {
      const results = await Promise.allSettled([s.claim(), s.claim()])
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
      await mkdir(join(s.dir, 'transaction.lock'))
      await expect(s.claim()).rejects.toThrow('locked')
    } finally { await s.cleanup() }
  })
  it('blocks excess spend and turns a post-claim stop into reconciliation', async () => {
    const s = await setup()
    try {
      const claim = await s.claim()
      await expect(settleSimulation({ store: s.store, claim, outcome: { kind: 'confirmed', spentCents: 101 }, now })).rejects.toThrow('reservation')
      await saveSimulationRelease(s.store, { ...s.record, state: 'stopped', version: 3 })
      expect((await settleSimulation({ store: s.store, claim, outcome: { kind: 'confirmed', spentCents: 10 }, now })).state).toBe('uncertain')
      await expect(saveSimulationRelease(s.store, { ...s.record, version: 4 })).rejects.toThrow('conflicting')
    } finally { await s.cleanup() }
  })
  it('rejects expired authority and missing dependency receipts', async () => {
    const s = await setup()
    try {
      await expect(claimSimulation({ store: s.store, releaseId: s.record.manifest.releaseId, hash: s.record.hash, actionId: s.record.manifest.actions[0].id, now: new Date('2026-10-05') })).rejects.toThrow('expired')
      const manifest = structuredClone(s.record.manifest)
      manifest.releaseId = '11111111-1111-4111-8111-000000000009'
      const first = manifest.actions[0]
      first.maxSpendCents = 50
      manifest.actions.push({ ...structuredClone(first), id: '11111111-1111-4111-8111-000000000008', source: { ...first.source, id: '11111111-1111-4111-8111-000000000007' }, dependsOn: [first.id] })
      const record = { ...s.record, manifest, hash: releaseHash(manifest) }
      await saveSimulationRelease(s.store, record)
      await expect(claimSimulation({ store: s.store, releaseId: manifest.releaseId, hash: record.hash, actionId: manifest.actions[1].id, now })).rejects.toThrow('predecessor')
      const claim = await claimSimulation({ store: s.store, releaseId: manifest.releaseId, hash: record.hash, actionId: first.id, now })
      await settleSimulation({ store: s.store, claim, outcome: { kind: 'confirmed', spentCents: 50 }, now })
      await expect(claimSimulation({ store: s.store, releaseId: manifest.releaseId, hash: record.hash, actionId: manifest.actions[1].id, now })).resolves.toHaveProperty('owner')
    } finally { await s.cleanup() }
  })
  it('keeps every provider disabled, including Slack and parked SMS', async () => {
    expect(Object.values(disabledCampaignAdapters).every(adapter => adapter.enabled === false)).toBe(true)
    await expect(disabledCampaignAdapters.gmail.execute()).rejects.toThrow('disabled')
    expect((await disabledCampaignAdapters.slack.preflight()).ready).toBe(false)
    expect(disabledCampaignAdapters.telnyx.reason).toContain('parked')
  })
})
