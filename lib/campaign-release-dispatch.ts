import type { AtomicCampaignAuthority, AtomicCampaignRequest } from './campaign-release-atomic-authority'
import { randomUUID } from 'node:crypto'
import { approvalIdentity, type CampaignApprovalSource } from './campaign-release-activation'
import { campaignActionKeys, releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import { campaignReceiptContext, type AttemptFence, type CampaignTransactionStore, type ExecutionAttempt, type ExecutionState } from './campaign-release-execution'

export type DispatchIntent = {
  id: string; mode: 'disabled'; status: 'prepared' | 'refused'
  atomicRequest?: AtomicCampaignRequest
  approval: ReturnType<typeof approvalIdentity>; sourceDigest: string; dependencyDigest: string
  journalVersion: number; reservedCents: number; checkedAt: string; reason: string
}
const disabled = 'Cross-store atomic authority unavailable. Provider dispatch disabled.'
function sources(record: ReleaseRecord) {
  return releaseHash([...record.manifest.actions.map(a => a.source), ...(record.manifest.planningSources ?? [])])
}
function exactAuthority(state: ExecutionState, record: ReleaseRecord, now: Date) {
  const identity = approvalIdentity(record, now), binding = state.approvalBindings?.[identity.releaseId]
  if (!binding || binding.status !== 'bound' || binding.executionEnabled !== false ||
    releaseHash({ releaseId: binding.releaseId, manifestHash: binding.manifestHash, approvalVersion: binding.approvalVersion, auditHash: binding.auditHash }) !== releaseHash(identity) ||
    releaseHash(state.releases[identity.releaseId]) !== releaseHash(record)) throw new Error('Canonical binding stale or unavailable.')
  return identity
}
function validateAttempt(state: ExecutionState, attempt: ExecutionAttempt, record: ReleaseRecord, now: Date) {
  const action = record.manifest.actions.find(a => a.id === attempt.actionId)
  if (!action || attempt.manifestHash !== record.hash || attempt.releaseId !== record.manifest.releaseId ||
    releaseHash(campaignActionKeys(record.manifest, action.id)) !== releaseHash({ deliveryKey: attempt.deliveryKey, authorizationKey: attempt.authorizationKey, contentHash: attempt.contentHash })) throw new Error('Dispatch manifest identity mismatch.')
  if (Date.parse(action.scheduledFor) > +now || Date.parse(action.evidenceExpiresAt) <= +now) throw new Error('Dispatch schedule or evidence invalid.')
  const committed = Object.values(state.attempts).filter(a => a.releaseId === attempt.releaseId).reduce((sum, a) => {
    if (![a.reservedCents, a.spentCents].every(c => Number.isSafeInteger(c) && c >= 0)) throw new Error('Invalid budget reservation.')
    return sum + a.reservedCents + a.spentCents
  }, 0)
  if (attempt.reservedCents !== action.maxSpendCents || committed > record.manifest.spendCapCents) throw new Error('Dispatch budget exhausted or reservation changed.')
  return releaseHash(campaignReceiptContext(state, attempt).predecessors)
}
/** Unregistered server-owned protocol; no transport can be supplied.
 * authorizeSandbox uses the optional SQL boundary for atomic sandbox intent only.
 * Legacy prepare/dispatch keeps the Phase 5 durable refusal because independent
 * canonical/source reads and journal CAS cannot prove atomic authority.
 * Every path keeps actual provider dispatch disabled. */
export class CampaignDispatchFence {
  constructor(private readonly source: CampaignApprovalSource, private readonly store: CampaignTransactionStore, private readonly atomic?: AtomicCampaignAuthority) {}
  async authorizeSandbox(input: AtomicCampaignRequest) {
    if (!this.atomic) throw new Error(disabled)
    return this.atomic.authorize(input)
  }
  async prepare(input: { releaseId: string; hash: string; approvalVersion: number; actionId: string; owner: string; journalVersion: number; now: Date }) {
    const record = structuredClone(await this.source.read(input.releaseId))
    const identity = approvalIdentity(record, input.now)
    if (identity.releaseId !== input.releaseId || identity.manifestHash !== input.hash || identity.approvalVersion !== input.approvalVersion || !input.owner.trim()) throw new Error('Stale dispatch request.')
    await this.source.assertCurrentSources(record.manifest)
    return this.store.transaction(state => {
      if (state.version !== input.journalVersion) throw new Error('Journal CAS version changed.')
      exactAuthority(state, record, input.now)
      const action = record.manifest.actions.find(a => a.id === input.actionId)
      if (!action) throw new Error('Unknown dispatch action.')
      const keys = campaignActionKeys(record.manifest, action.id)
      if (state.attempts[keys.deliveryKey]) throw new Error('Duplicate delivery ownership; reconcile intent.')
      const attempt: ExecutionAttempt = { id: randomUUID(), releaseId: input.releaseId, actionId: action.id, manifestHash: input.hash, ...keys,
        owner: input.owner, version: 1, leaseUntil: new Date(+input.now + 60_000).toISOString(), state: 'claimed', tryCount: 1,
        reservedCents: action.maxSpendCents, spentCents: 0, events: [{ at: input.now.toISOString(), kind: 'dispatch_intent_prepared' }], callbacks: {} }
      state.attempts[keys.deliveryKey] = attempt
      const dependencyDigest = validateAttempt(state, attempt, record, input.now)
      attempt.dispatchIntent = { id: randomUUID(), mode: 'disabled', status: 'prepared', approval: identity, sourceDigest: sources(record), dependencyDigest,
        journalVersion: state.version + 1, reservedCents: action.maxSpendCents, checkedAt: input.now.toISOString(), reason: disabled }
      state.ledger.push({ attemptId: attempt.id, kind: 'reserve', cents: action.maxSpendCents, at: input.now.toISOString() })
      return attempt
    })
  }
  /** Always returns dispatched:false. Atomic receipts are revalidated by exact RPC replay;
   * Phase 5 intents retain their unconditional durable refusal.
   * Legacy failed/stale reads persist refusal when the caller still owns the fence.
   * Atomic failures throw and preserve the existing historical receipt/reservation.
   * A crash/uncertain CAS never returns permission and never releases a reservation. */
  async dispatch(fence: AttemptFence, journalVersion: number, now: Date): Promise<{ dispatched: false; reason: string; attempt: ExecutionAttempt }> {
    if (!Number.isFinite(+now)) throw new Error('Invalid dispatch time.')
    const snapshot = await this.store.snapshot(), prior = snapshot.attempts[fence.deliveryKey]
    if (!prior?.dispatchIntent) throw new Error('Dispatch intent required.')
    if (prior.dispatchIntent.atomicRequest) {
      if (!this.atomic || prior.owner !== fence.owner || prior.version !== fence.version || snapshot.version !== journalVersion) throw new Error('Atomic dispatch ownership or journal changed.')
      const attempt = await this.atomic.authorize(prior.dispatchIntent.atomicRequest)
      return { dispatched: false, reason: 'Atomic sandbox intent qualified. Provider dispatch disabled.', attempt }
    }
    let record: ReleaseRecord | undefined, reason = disabled
    try {
      record = structuredClone(await this.source.read(prior.releaseId))
      const identity = approvalIdentity(record, now)
      if (releaseHash(identity) !== releaseHash(prior.dispatchIntent.approval)) throw new Error('Canonical authority changed.')
      await this.source.assertCurrentSources(record.manifest)
    } catch { reason = 'Canonical authority, source or evidence changed. Prepare a fresh release.'; record = undefined }
    return this.store.transaction(state => {
      const attempt = state.attempts[fence.deliveryKey]
      if (state.version !== journalVersion || !attempt || attempt.owner !== fence.owner || attempt.version !== fence.version || Date.parse(attempt.leaseUntil) <= +now) throw new Error('Dispatch ownership, lease or journal CAS changed.')
      const intent = attempt.dispatchIntent
      if (!intent || intent.status !== 'prepared' || attempt.state !== 'claimed') throw new Error('Dispatch intent already consumed or unavailable.')
      if (record) {
        try {
          exactAuthority(state, record, now)
          if (intent.journalVersion !== journalVersion || intent.reservedCents !== attempt.reservedCents || intent.sourceDigest !== sources(record) || intent.dependencyDigest !== validateAttempt(state, attempt, record, now)) throw new Error('Dispatch evidence changed.')
        } catch { reason = 'Dispatch binding, dependency or budget changed. Reconcile intent.' }
      }
      intent.status = 'refused'; intent.reason = reason; intent.checkedAt = now.toISOString()
      attempt.version++; attempt.events.push({ at: now.toISOString(), kind: 'dispatch_refused' })
      // Retain ownership and reservation for explicit reconciliation. Never imply submission.
      return { dispatched: false as const, reason, attempt }
    })
  }
}
