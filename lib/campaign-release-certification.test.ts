// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { campaignCertificationContracts, certifiedSandboxCallback } from './campaign-release-certification'
import { CampaignExecutionJournal, attemptFence, campaignReceiptContext, emptyExecutionState, type ExecutionState } from './campaign-release-execution'
import { DurableCampaignExecutionStore, type CampaignJournalRpc } from './campaign-release-durable-store'
import { releaseHash, type CampaignReleaseAction } from './campaign-release-manifest'
import { fixture } from './campaign-release-test-fixture'
const now = new Date('2026-10-03T13:00:00Z')
class Database implements CampaignJournalRpc {
  state = emptyExecutionState()
  async rpc(name: string, args?: Record<string, unknown>) {
    if (name === 'campaign_execution_snapshot') return { data: structuredClone(this.state), error: null }
    if (args!.expected_version !== this.state.version) return { data: false, error: null }
    this.state = structuredClone(args!.next_state as ExecutionState); return { data: true, error: null }
  }
}
async function sandbox(provider: CampaignReleaseAction['provider']) {
  const manifest = fixture(), action = manifest.actions[0], contract = campaignCertificationContracts[provider]
  action.provider = provider; action.operation = contract.operation as CampaignReleaseAction['operation']; action.expectedReceipt = contract.receipt as CampaignReleaseAction['expectedReceipt']
  action.maxSpendCents = 50; manifest.spendCapCents = 100
  if (provider === 'heygen') action.source.table = 'video_generation_jobs'
  if (provider === 'gmail' || provider === 'manual_social') {
    manifest.class = 'relationship_outreach_batch'; action.source.table = 'outreach_queue'
    action.recipients = [{ address: 'sandbox@example.invalid', consentEvidenceId: 'sandbox-consent', suppressionEvidenceId: 'sandbox-suppression' }]
  }
  const db = new Database(), store = new DurableCampaignExecutionStore(db), journal = new CampaignExecutionJournal(store), hash = releaseHash(manifest)
  await journal.prepare({ manifest, hash, state: 'pending', version: 1, audit: [] })
  await journal.decide(manifest.releaseId, hash, 'approve', 'synthetic-operator', now)
  const attempt = await journal.submit(attemptFence(await journal.claim({ releaseId: manifest.releaseId, hash, actionId: action.id, owner: 'sandbox', now })), now)
  return { db, store, journal, attempt, context: campaignReceiptContext(db.state, attempt) }
}
describe('operation certification contracts over deterministic sandbox doubles', () => {
  it.each(['linkedin', 'instagram', 'facebook', 'x', 'tiktok', 'gmail', 'heygen', 'youtube', 'manual_social'] as const)('%s acceptance, confirmation and replay use the existing journal', async provider => {
    const x = await sandbox(provider)
    const accepted = certifiedSandboxCallback(x.context, { outcome: 'provider_accepted', sequence: 1, at: now.toISOString() })
    const waiting = await x.journal.reconcileVerified(attemptFence(x.attempt), accepted, now)
    expect(waiting.state).toBe('reconciliation_required'); expect(waiting.reservedCents).toBe(50)
    const confirmed = certifiedSandboxCallback(x.context, { outcome: 'provider_confirmed', sequence: 2, at: now.toISOString(), spentCents: 25 })
    const done = await x.journal.reconcileVerified(attemptFence(waiting), confirmed, now)
    expect(done.state).toBe('confirmed'); expect(done.spentCents).toBe(25)
    const restarted = new CampaignExecutionJournal(new DurableCampaignExecutionStore(x.db))
    const replay = certifiedSandboxCallback(x.context, { outcome: 'provider_confirmed', sequence: 2, at: now.toISOString(), spentCents: 25 })
    expect(await restarted.reconcileVerified(attemptFence(waiting), replay, now)).toEqual(done)
    expect(x.db.state.ledger.filter(e => e.kind === 'spend')).toHaveLength(1)
    expect(campaignCertificationContracts[provider]).toMatchObject({ enabled: false, acceptedIsComplete: false })
  })
  it.each(['linkedin', 'gmail', 'heygen', 'youtube', 'manual_social'] as const)('%s uncertainty retains budget, callback conflict rejects, no-delivery releases', async provider => {
    const x = await sandbox(provider)
    const event = { sequence: 1, at: now.toISOString() }
    const uncertain = await x.journal.reconcileVerified(attemptFence(x.attempt), certifiedSandboxCallback(x.context, { ...event, outcome: 'uncertain' }), now)
    expect(uncertain.reservedCents).toBe(50)
    await expect(x.journal.retry(attemptFence(uncertain), now)).rejects.toThrow('Retry unavailable')
    await expect(x.journal.reconcileVerified(attemptFence(uncertain), certifiedSandboxCallback(x.context, { ...event, outcome: 'rejected' }), now)).rejects.toThrow('Conflicting callback')
    const rejected = await x.journal.reconcileVerified(attemptFence(uncertain), certifiedSandboxCallback(x.context, { ...event, sequence: 2, outcome: 'rejected' }), now)
    expect(rejected.state).toBe('retryable'); expect(rejected.reservedCents).toBe(0)
  })
  it('keeps SMS parked and refuses receipt-contract mismatch or acceptance with a charge', async () => {
    const x = await sandbox('linkedin')
    expect(campaignCertificationContracts.sms).toMatchObject({ mode: 'parked', enabled: false })
    expect(() => certifiedSandboxCallback({ ...x.context, provider: 'sms' as CampaignReleaseAction['provider'] }, { outcome: 'provider_confirmed', sequence: 1, at: now.toISOString() })).toThrow('parked')
    expect(() => certifiedSandboxCallback({ ...x.context, receiptType: 'gmail_message_id' }, { outcome: 'provider_confirmed', sequence: 1, at: now.toISOString() })).toThrow('mismatch')
    expect(() => certifiedSandboxCallback(x.context, { outcome: 'provider_accepted', sequence: 1, at: now.toISOString(), spentCents: 1 })).toThrow('reservation')
  })
})
