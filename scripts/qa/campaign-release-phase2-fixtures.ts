/** No credentials or database access. Produces UI snapshots from actual durable simulator transitions. */
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { CampaignReleaseFileStore } from '../../lib/campaign-release-file-store'
import { fixture } from '../../lib/campaign-release-test-fixture'
import { releaseHash, campaignSourceFingerprint } from '../../lib/campaign-release-manifest'
import { assembleCampaignPacket } from '../../lib/campaign-release-packet'
import { saveSimulationRelease, claimSimulation, settleSimulation, reconcileSimulation } from '../../lib/campaign-release-simulation'
import { campaignReleaseProgress } from '../../lib/campaign-release-progress'
async function main() {
  const manifest = fixture()
  manifest.releaseId = '22222222-2222-4222-8222-222222222222'
  manifest.campaignId = '11111111-1111-4111-8111-111111111111'
  manifest.actions[0].id = manifest.campaignId
  manifest.expiresAt = '2099-10-04T00:00:00Z'; manifest.spendCapCents = 100
  manifest.actions[0].evidenceExpiresAt = manifest.expiresAt; manifest.actions[0].maxSpendCents = 100
  const action = manifest.actions[0], row = { id: action.source.id, campaign_id: manifest.campaignId, post_text: action.copy.body }
  const copy = { ...action.copy, metadata: {} }
  const packet = await assembleCampaignPacket({ manifest, plans: [{ ...action, review: { sourceFingerprint: campaignSourceFingerprint(row), contentHash: releaseHash({ copy, assets: action.assets }), accountId: action.accountId, recipientHash: releaseHash(action.recipients), expiresAt: action.evidenceExpiresAt } }],
    reader: { campaign: async () => ({ id: manifest.campaignId, name: 'Synthetic community workshop' }), source: async () => row } })
  const record = { manifest: packet, hash: releaseHash(packet), state: 'approved' as const, version: 2, audit: [] }
  const directory = await mkdtemp(join(tmpdir(), 'campaign-phase2-'))
  const store = new CampaignReleaseFileStore(directory), now = new Date('2026-10-03T13:00:00Z')
  await saveSimulationRelease(store, record)
  const input = { store, releaseId: packet.releaseId, hash: record.hash, actionId: action.id, now }
  const snapshots: Record<string, unknown> = {}
  const capture = async (name: string) => { snapshots[name] = await store.transact(state => campaignReleaseProgress(state, record)) }
  const first = await claimSimulation(input); await capture('claimed')
  await settleSimulation({ store, claim: first, now, outcome: { kind: 'not_dispatched' } }); await capture('not_dispatched')
  const second = await claimSimulation(input)
  const uncertain = await settleSimulation({ store, claim: second, now, outcome: { kind: 'uncertain' } }); await capture('uncertain')
  await reconcileSimulation({ store, key: second.key, version: uncertain.version, now, spentCents: 40, evidence: 'Synthetic lookup after restart', receipt: {
    provider: action.provider, accountId: action.accountId, actionKey: second.key, contentHash: releaseHash({ copy, assets: action.assets }), receiptType: action.expectedReceipt, providerId: 'synthetic:verified-local-receipt', receivedAt: now.toISOString(),
  } }); await capture('confirmed')
  const output = resolve('local-private/campaign-phase2-qa'); await mkdir(output, { recursive: true })
  await writeFile(join(output, 'simulation-fixtures.json'), JSON.stringify({ record, snapshots }, null, 2))
  console.log('Assembled packet, durable attempts, no-dispatch retry and uncertain reconciliation verified locally.')
}
void main()
