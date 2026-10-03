// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixture } from './campaign-release-test-fixture'
import { releaseHash, type CampaignReleaseManifest } from './campaign-release-manifest'
import { CampaignExecutionJournal, attemptFence, type ExecutionAttempt } from './campaign-release-execution'
import { LocalCampaignExecutionStore } from './campaign-release-local-store'
import { campaignDeliveryAdapters, syntheticCampaignReceipt } from './campaign-release-adapters'

const now = new Date('2026-10-03T13:00:00Z'), later = new Date(+now + 61_000)
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function setup(manifest = fixture()) {
  const dir = await mkdtemp(join(tmpdir(), 'campaign-journal-')); dirs.push(dir)
  const path = join(dir, 'state.json'), store = new LocalCampaignExecutionStore(path), journal = new CampaignExecutionJournal(store)
  const hash = releaseHash(manifest)
  await journal.prepare({ manifest, hash, state: 'pending', version: 1, audit: [] })
  await journal.decide(manifest.releaseId, hash, 'approve', 'synthetic-admin', now)
  const claim = (actionId = manifest.actions[0].id, owner = 'worker-a', at = now) => journal.claim({ releaseId: manifest.releaseId, hash, actionId, owner, now: at })
  const confirm = (attempt: ExecutionAttempt, at = now) => journal.reconcile(attemptFence(attempt), { callbackId: `receipt:${attempt.id}`, evidenceId: 'synthetic-proof', outcome: 'confirmed', spentCents: 0, receipt: syntheticCampaignReceipt(manifest.actions.find(a => a.id === attempt.actionId)!, attempt, at.toISOString()) }, at)
  return { path, store, journal, claim, confirm, hash, manifest }
}
function twoSteps(): CampaignReleaseManifest {
  const m = fixture(); m.spendCapCents = 100; m.actions[0].maxSpendCents = 50
  m.actions.push({ ...structuredClone(m.actions[0]), id: '11111111-1111-4111-8111-000000000005', source: { ...m.actions[0].source, id: '11111111-1111-4111-8111-000000000006' }, dependsOn: [m.actions[0].id] })
  return m
}
describe('durable synthetic campaign coordination', () => {
  it('requires exact-hash approval and rejects stale evidence', async () => {
    const x = await setup()
    await expect(x.journal.claim({ releaseId: x.manifest.releaseId, hash: 'b'.repeat(64), actionId: x.manifest.actions[0].id, owner: 'a', now })).rejects.toThrow('Exact-hash')
    await expect(x.claim(undefined, undefined, new Date('2026-10-04T00:00:00Z'))).rejects.toThrow('expired')
    expect(Object.keys((await x.store.snapshot()).attempts)).toHaveLength(0)
  })
  it('retains delivery identity across restart and prevents duplicate claims', async () => {
    const x = await setup(), a = await x.claim()
    const restarted = new CampaignExecutionJournal(new LocalCampaignExecutionStore(x.path))
    await expect(restarted.claim({ releaseId: x.manifest.releaseId, hash: x.hash, actionId: a.actionId, owner: 'b', now })).rejects.toThrow('already claimed')
    expect((await restarted.store.snapshot()).attempts[a.deliveryKey].id).toBe(a.id)
  })
  it('atomically serializes contention and only reserves once', async () => {
    const x = await setup(twoSteps())
    const results = await Promise.allSettled([x.claim(), x.claim()])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const state = await x.store.snapshot()
    expect(state.ledger.filter(e => e.kind === 'reserve').reduce((sum, e) => sum + e.cents, 0)).toBe(50)
    expect(Object.values(state.attempts)).toHaveLength(1)
  })
  it('keeps partial completion and requires the predecessor receipt', async () => {
    const x = await setup(twoSteps())
    await expect(x.claim(x.manifest.actions[1].id)).rejects.toThrow('Dependency')
    const a = await x.journal.submit(attemptFence(await x.claim()), now)
    await x.confirm(a)
    const b = await x.journal.submit(attemptFence(await x.claim(x.manifest.actions[1].id)), now)
    await x.journal.reconcile(attemptFence(b), { callbackId: 'timeout', evidenceId: 'synthetic-timeout', outcome: 'uncertain', spentCents: 0 }, now)
    const states = Object.values((await x.store.snapshot()).attempts)
    expect(states.map(s => s.state)).toEqual(['confirmed', 'reconciliation_required'])
    expect(states[1].reservedCents).toBe(50)
  })
  it('deduplicates exact callbacks and rejects conflicting callbacks', async () => {
    const x = await setup(), a = await x.journal.submit(attemptFence(await x.claim()), now)
    const first = await x.confirm(a), second = await x.confirm(a)
    expect(second.version).toBe(first.version)
    await expect(x.journal.reconcile(attemptFence(first), { callbackId: `receipt:${a.id}`, evidenceId: 'changed', outcome: 'uncertain', spentCents: 0 }, now)).rejects.toThrow('Conflicting')
  })
  it('rejects a receipt for different content, account, or delivery key', async () => {
    const x = await setup(), a = await x.journal.submit(attemptFence(await x.claim()), now)
    for (const change of [{ contentHash: 'e'.repeat(64) }, { accountId: 'other' }, { actionKey: 'other' }]) {
      await expect(x.journal.reconcile(attemptFence(a), { callbackId: 'receipt', evidenceId: 'proof', outcome: 'confirmed', spentCents: 0, receipt: { ...syntheticCampaignReceipt(x.manifest.actions[0], a, now.toISOString()), ...change } }, now)).rejects.toThrow('does not match')
    }
  })
  it('recovers expired submitted ownership without resending and fences the old worker', async () => {
    const x = await setup(), a = await x.journal.submit(attemptFence(await x.claim()), now)
    const recovered = await x.journal.recover(a.deliveryKey, a.version, 'worker-b', later)
    expect(recovered.state).toBe('reconciliation_required')
    await expect(x.confirm(a, later)).rejects.toThrow('Ownership changed')
    await expect(x.journal.retry(attemptFence(recovered), later)).rejects.toThrow('Retry unavailable')
    expect((await x.confirm(recovered, later)).state).toBe('confirmed')
  })
  it('allows bounded retry only after no-delivery proof and rechecks authority', async () => {
    const x = await setup(), a = await x.journal.submit(attemptFence(await x.claim()), now)
    const noDelivery = await x.journal.reconcile(attemptFence(a), { callbackId: 'not-delivered', evidenceId: 'verified-absence', outcome: 'not_delivered', spentCents: 0 }, now)
    const retry = await x.journal.retry(attemptFence(noDelivery), now)
    expect(retry.tryCount).toBe(2); expect(retry.deliveryKey).toBe(a.deliveryKey)
    await x.journal.decide(x.manifest.releaseId, x.hash, 'stop', 'operator', now)
    await expect(x.journal.submit(attemptFence(retry), now)).rejects.toThrow()
    await expect(x.journal.decide(x.manifest.releaseId, x.hash, 'approve', 'operator', now)).rejects.toThrow('Stopped')
  })
  it('accepts late receipts after stop without reopening the release', async () => {
    const x = await setup(twoSteps()), a = await x.journal.submit(attemptFence(await x.claim()), now)
    await x.journal.decide(x.manifest.releaseId, x.hash, 'stop', 'operator', now)
    expect((await x.store.snapshot()).attempts[a.deliveryKey].reservedCents).toBe(50)
    await x.confirm(a)
    expect((await x.store.snapshot()).releases[x.manifest.releaseId].state).toBe('stopped')
    await expect(x.claim(x.manifest.actions[1].id)).rejects.toThrow('stopped')
  })
  it('retains reservations on uncertainty and rejects overspend evidence', async () => {
    const x = await setup(twoSteps()), a = await x.journal.submit(attemptFence(await x.claim()), now)
    await expect(x.journal.reconcile(attemptFence(a), { callbackId: 'over', evidenceId: 'proof', outcome: 'confirmed', spentCents: 51, receipt: syntheticCampaignReceipt(x.manifest.actions[0], a, now.toISOString()) }, now)).rejects.toThrow('budget')
    expect((await x.store.snapshot()).attempts[a.deliveryKey].reservedCents).toBe(50)
  })
  it('rolls back failed transactions and fails closed on a crash-held lock', async () => {
    const x = await setup(), before = await readFile(x.path, 'utf8')
    await expect(x.store.transaction(s => { s.ledger.push({ attemptId: 'bad', kind: 'spend', cents: 99, at: now.toISOString() }); throw new Error('abort') })).rejects.toThrow('abort')
    expect(await readFile(x.path, 'utf8')).toBe(before)
    await writeFile(`${x.path}.lock`, 'synthetic crash lock')
    await expect(x.claim()).rejects.toMatchObject({ code: 'EEXIST' })
    expect(await readFile(x.path, 'utf8')).toBe(before)
  })
  it('keeps every delivery family disabled and excludes SMS', async () => {
    const registry = campaignDeliveryAdapters()
    expect(Object.keys(registry)).toEqual(['social', 'warm_outreach', 'video_youtube', 'gmail', 'slack'])
    for (const adapter of Object.values(registry)) {
      expect(adapter.enabled).toBe(false); expect((await adapter.preflight()).ready).toBe(false)
      await expect(adapter.execute()).rejects.toThrow('No delivery attempted')
    }
  })
  it('caps retry attempts and never treats a timeout as no-delivery proof', async () => {
    const x = await setup()
    let attempt = await x.journal.submit(attemptFence(await x.claim()), now)
    for (let n = 1; n <= 3; n++) {
      const uncertain = await x.journal.reconcile(attemptFence(attempt), { callbackId: `timeout-${n}`, evidenceId: 'timeout-only', outcome: 'uncertain', spentCents: 0 }, now)
      await expect(x.journal.retry(attemptFence(uncertain), now)).rejects.toThrow('Retry unavailable')
      const proof = await x.journal.reconcile(attemptFence(uncertain), { callbackId: `absence-${n}`, evidenceId: 'trusted-absence-proof', outcome: 'not_delivered', spentCents: 0 }, now)
      if (n === 3) await expect(x.journal.retry(attemptFence(proof), now)).rejects.toThrow('Retry unavailable')
      else attempt = await x.journal.submit(attemptFence(await x.journal.retry(attemptFence(proof), now)), now)
    }
  })
  it('rechecks evidence between claim and submission and preserves the reservation', async () => {
    const manifest = twoSteps(); manifest.actions[0].evidenceExpiresAt = '2026-10-03T13:00:01Z'
    const x = await setup(manifest), attempt = await x.claim()
    await expect(x.journal.submit(attemptFence(attempt), new Date(+now + 2000))).rejects.toThrow('Evidence expired')
    expect((await x.store.snapshot()).attempts[attempt.deliveryKey].reservedCents).toBe(50)
  })
})


it('recovers a pre-submit crash as definite no-dispatch, fences the old worker and reserves only once', async () => {
  const x = await setup(twoSteps()), a = await x.claim()
  const recovered = await x.journal.recover(a.deliveryKey, a.version, 'worker-b', later)
  expect(recovered.state).toBe('retryable')
  await expect(x.journal.submit(attemptFence(a), later)).rejects.toThrow('Ownership changed')
  const retry = await x.journal.retry(attemptFence(recovered), later)
  expect(retry.reservedCents).toBe(50)
  const state = await x.store.snapshot()
  expect(state.ledger.filter(e => e.kind === 'reserve')).toHaveLength(1)
  retry.reservedCents = 999
  expect((await x.store.snapshot()).attempts[a.deliveryKey].reservedCents).toBe(50)
})


it('requires a matching predecessor receipt, not only a confirmed state', async () => {
  const x = await setup(twoSteps()), a = await x.journal.submit(attemptFence(await x.claim()), now)
  await x.confirm(a)
  await x.store.transaction(state => { state.attempts[a.deliveryKey].receipt!.accountId = 'wrong-account' })
  await expect(x.claim(x.manifest.actions[1].id)).rejects.toThrow('Dependency receipt required')
  expect(Object.values((await x.store.snapshot()).attempts)).toHaveLength(1)
})
