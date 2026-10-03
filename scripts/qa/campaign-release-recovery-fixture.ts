import { CampaignDispatchFence } from '../../lib/campaign-release-dispatch'
import { hydrateApprovedCampaign } from '../../lib/campaign-release-activation'
import { campaignReceiptContext } from '../../lib/campaign-release-execution'
import { sandboxReceiptVerifier, type ReceiptTrust } from '../../lib/campaign-release-receipts'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixture } from '../../lib/campaign-release-test-fixture'
import { decideCampaignRelease, releaseHash } from '../../lib/campaign-release-manifest'
import { CampaignExecutionJournal, attemptFence } from '../../lib/campaign-release-execution'
import { LocalCampaignExecutionStore } from '../../lib/campaign-release-local-store'
import { syntheticExecutionProgress } from '../../lib/campaign-release-recovery-view'
import { syntheticCampaignReceipt } from '../../lib/campaign-release-adapters'

async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'campaign-recovery-evidence-'))
  const path = join(dir, 'journal.json')
  const store = new LocalCampaignExecutionStore(path)
  let journal = new CampaignExecutionJournal(store)
  const manifest = fixture(), now = new Date('2026-10-03T13:00:00Z')
  manifest.objective = 'Synthetic workshop release'; manifest.expiresAt = '2099-10-04T00:00:00Z'; manifest.spendCapCents = 200
  manifest.actions[0].evidenceExpiresAt = manifest.expiresAt; manifest.actions[0].maxSpendCents = 100
  manifest.actions.push({ ...structuredClone(manifest.actions[0]), id: '11111111-1111-4111-8111-000000000005', provider: 'youtube', source: { ...manifest.actions[0].source, id: '11111111-1111-4111-8111-000000000006' }, copy: { title: 'Synthetic workshop film', body: 'Local recovery demonstration.', metadata: {} }, dependsOn: [manifest.actions[0].id] })
  const hash = releaseHash(manifest), frames: Record<string, unknown> = {}
  const capture = async (name: string) => { const state = await store.snapshot(); frames[name] = { releases: [state.releases[manifest.releaseId]], executionProgress: syntheticExecutionProgress(state.releases[manifest.releaseId], Object.values(state.attempts)), approvalProgress: Object.values(state.approvalBindings ?? {}).map(({ auditHash: _audit, executionEnabled: _disabled, ...binding }) => binding), providerExecutionEnabled: false } }
  await journal.prepare({ manifest, hash, state: 'pending', version: 1, audit: [] }); await capture('pending')
  await journal.decide(manifest.releaseId, hash, 'approve', 'portfolio:synthetic-admin', now); await capture('approved')
  const claim = (actionId: string) => journal.claim({ releaseId: manifest.releaseId, hash, actionId, owner: 'synthetic-worker', now })
  const first = await journal.submit(attemptFence(await claim(manifest.actions[0].id)), now)
  const verify = async (trust: ReceiptTrust, callbackId: string) => {
    const state = await store.snapshot(), context = campaignReceiptContext(state, state.attempts[first.deliveryKey])
    const event = { ...context, trust, callbackId, evidenceId: 'sandbox-fixture', providerId: 'sandbox:first-receipt', receivedAt: now.toISOString(), spentCents: trust === 'provider_confirmed' ? 25 : 0 }
    return sandboxReceiptVerifier([event]).verify(event, context)
  }
  const accepted = await journal.reconcileVerified(attemptFence(first), await verify('provider_accepted', 'accepted'), now); await capture('accepted')
  await journal.reconcileVerified(attemptFence(accepted), await verify('provider_confirmed', 'confirmed'), now)
  await capture('partial')
  const second = await journal.submit(attemptFence(await claim(manifest.actions[1].id)), now); await capture('submitted')
  // Reconstruct the journal from disk, then recover the expired fence.
  journal = new CampaignExecutionJournal(new LocalCampaignExecutionStore(path))
  const later = new Date(+now + 61_000)
  const recovered = await journal.recover(second.deliveryKey, second.version, 'synthetic-recovery-worker', later); await capture('uncertain')
  const proof = await journal.reconcile(attemptFence(recovered), { trust: 'synthetic', callbackId: 'absence-proof', evidenceId: 'synthetic-verified-no-delivery', outcome: 'not_delivered', spentCents: 0 }, later); await capture('retryable')
  const retry = await journal.submit(attemptFence(await journal.retry(attemptFence(proof), later)), later)
  await journal.reconcile(attemptFence(retry), { trust: 'synthetic', callbackId: 'second-confirmed', evidenceId: 'synthetic-proof-2', outcome: 'confirmed', spentCents: 50, receipt: syntheticCampaignReceipt(manifest.actions[1], retry, later.toISOString()) }, later); await capture('recovered')
  const approved = structuredClone((await store.snapshot()).releases[manifest.releaseId])
  for (const decision of ['hold', 'revise'] as const) {
    const record = decideCampaignRelease(approved, hash, decision, 'portfolio:synthetic-admin', later)
    frames[decision] = { releases: [record], executionProgress: [], providerExecutionEnabled: false }
  }
  await journal.decide(manifest.releaseId, hash, 'stop', 'synthetic-admin', later); await capture('stopped')
  // Separate local journal proves hydration without connecting a production worker.
  const bindingStore = new LocalCampaignExecutionStore(join(dir, 'bound.json'))
  const binding = await hydrateApprovedCampaign({ releaseId: manifest.releaseId, expectedHash: hash, expectedVersion: approved.version, source: { read: async () => approved, assertCurrentSources: async () => {} }, store: bindingStore, now: () => later })
  const { auditHash: _audit, executionEnabled: _disabled, ...progress } = binding
  frames.bound = { releases: [approved], executionProgress: [], approvalProgress: [progress], providerExecutionEnabled: false }
  const protocol = new CampaignDispatchFence({ read: async () => approved, assertCurrentSources: async () => {} }, bindingStore)
  const intent = await protocol.prepare({ releaseId: manifest.releaseId, hash, approvalVersion: approved.version, actionId: manifest.actions[0].id, owner: 'sandbox-intent', journalVersion: (await bindingStore.snapshot()).version, now: later })
  frames.fenced = { releases: [approved], executionProgress: syntheticExecutionProgress(approved, [intent]), approvalProgress: [progress], providerExecutionEnabled: false }
  const refusal = await protocol.dispatch(attemptFence(intent), (await bindingStore.snapshot()).version, later)
  if (refusal.dispatched !== false) throw new Error('Synthetic dispatch gate opened')
  frames.refused = { releases: [approved], executionProgress: syntheticExecutionProgress(approved, [refusal.attempt]), approvalProgress: [progress], providerExecutionEnabled: false }
  await mkdir('local-private/campaign-recovery', { recursive: true })
  await writeFile('local-private/campaign-recovery/frames.json', JSON.stringify(frames, null, 2))
  console.log('Saved synthetic recovery projections after durable journal transitions; no provider calls.')
}
void main()
