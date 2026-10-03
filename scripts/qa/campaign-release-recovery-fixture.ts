import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixture } from '../../lib/campaign-release-test-fixture'
import { releaseHash, decideCampaignRelease } from '../../lib/campaign-release-manifest'
import { CampaignExecutionJournal, attemptFence } from '../../lib/campaign-release-execution'
import { DurableCampaignExecutionStore } from '../../lib/campaign-release-durable-store'
import { LocalCampaignExecutionStore } from '../../lib/campaign-release-local-store'
import { syntheticExecutionProgress } from '../../lib/campaign-release-recovery-view'
import { syntheticCampaignReceipt } from '../../lib/campaign-release-adapters'

async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'campaign-recovery-evidence-'))
  const path = join(dir, 'journal.json')
  // Exercise the same CAS adapter with a disk-backed test transport. This proves local
  // restart persistence, not PostgreSQL isolation or deployed permissions.
  const local = new LocalCampaignExecutionStore(path)
  const conflict = new Error('CAS conflict')
  const store = new DurableCampaignExecutionStore({
    read: async () => { const state = await local.snapshot(); return state.version ? state : null },
    commit: async (expected, next) => {
      try {
        await local.transaction(state => {
          if ((state.version || null) !== expected) throw conflict
          Object.assign(state, structuredClone(next), { version: next.version - 1 })
        })
        return true
      } catch (error) { if (error === conflict) return false; throw error }
    },
  })
  let journal = new CampaignExecutionJournal(store)
  const manifest = fixture(), now = new Date('2026-10-03T13:00:00Z')
  manifest.objective = 'Synthetic workshop release'; manifest.expiresAt = '2099-10-04T00:00:00Z'; manifest.spendCapCents = 200
  manifest.actions[0].evidenceExpiresAt = manifest.expiresAt; manifest.actions[0].maxSpendCents = 100
  manifest.actions.push({ ...structuredClone(manifest.actions[0]), id: '11111111-1111-4111-8111-000000000005', provider: 'youtube', source: { ...manifest.actions[0].source, id: '11111111-1111-4111-8111-000000000006' }, copy: { title: 'Synthetic workshop film', body: 'Local recovery demonstration.', metadata: {} }, dependsOn: [manifest.actions[0].id] })
  const hash = releaseHash(manifest), frames: Record<string, unknown> = {}
  const capture = async (name: string) => { const state = await store.snapshot(); frames[name] = { releases: [state.releases[manifest.releaseId]], executionProgress: syntheticExecutionProgress(state.releases[manifest.releaseId], Object.values(state.attempts)), providerExecutionEnabled: false } }
  await journal.prepare({ manifest, hash, state: 'pending', version: 1, audit: [] }); await capture('pending')
  const pending = (await store.snapshot()).releases[manifest.releaseId]
  for (const decision of ['hold', 'revise'] as const) frames[decision] = { releases: [decideCampaignRelease(pending, hash, decision, 'synthetic-admin', now)], executionProgress: [], providerExecutionEnabled: false }
  await journal.decide(manifest.releaseId, hash, 'approve', 'synthetic-admin', now); await capture('approved')
  const claim = (actionId: string) => journal.claim({ releaseId: manifest.releaseId, hash, actionId, owner: 'synthetic-worker', now })
  const first = await journal.submit(attemptFence(await claim(manifest.actions[0].id)), now)
  await journal.reconcile(attemptFence(first), { mode: 'synthetic' as const, callbackId: 'first-confirmed', evidenceId: 'synthetic-proof-1', outcome: 'confirmed', spentCents: 25, receipt: syntheticCampaignReceipt(manifest.actions[0], first, now.toISOString()) }, now)
  await capture('partial')
  const second = await journal.submit(attemptFence(await claim(manifest.actions[1].id)), now); await capture('submitted')
  // Reconstruct the journal from disk, then recover the expired fence.
  journal = new CampaignExecutionJournal(store)
  const later = new Date(+now + 61_000)
  const recovered = await journal.recover(second.deliveryKey, second.version, 'synthetic-recovery-worker', later); await capture('uncertain')
  const proof = await journal.reconcile(attemptFence(recovered), { mode: 'synthetic' as const, callbackId: 'absence-proof', evidenceId: 'synthetic-verified-no-delivery', outcome: 'not_delivered', spentCents: 0 }, later); await capture('retryable')
  const retry = await journal.submit(attemptFence(await journal.retry(attemptFence(proof), later)), later)
  await journal.reconcile(attemptFence(retry), { mode: 'synthetic' as const, callbackId: 'second-confirmed', evidenceId: 'synthetic-proof-2', outcome: 'confirmed', spentCents: 50, receipt: syntheticCampaignReceipt(manifest.actions[1], retry, later.toISOString()) }, later); await capture('recovered')
  await journal.decide(manifest.releaseId, hash, 'stop', 'synthetic-admin', later); await capture('stopped')
  await mkdir('local-private/campaign-recovery', { recursive: true })
  await writeFile('local-private/campaign-recovery/frames.json', JSON.stringify(frames, null, 2))
  console.log('Saved synthetic recovery projections after durable journal transitions; no provider calls.')
}
void main()
