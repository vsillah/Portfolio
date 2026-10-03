import { randomUUID } from 'node:crypto'
import { campaignActionKeys, decideCampaignRelease, parseCampaignManifest, releaseHash, type CampaignReleaseAction, type ReleaseDecision, type ReleaseRecord } from './campaign-release-manifest'
import type { ActionReceipt } from './campaign-release-coordinator'

export type StepState = 'claimed' | 'submitted' | 'confirmed' | 'retryable' | 'reconciliation_required' | 'stopped'
export type ExecutionAttempt = {
  id: string; releaseId: string; actionId: string; manifestHash: string; deliveryKey: string; authorizationKey: string; contentHash: string
  owner: string; version: number; leaseUntil: string; state: StepState; tryCount: number
  reservedCents: number; spentCents: number; receipt?: ActionReceipt
  events: Array<{ at: string; kind: string; evidenceId?: string }>
  callbacks: Record<string, string>
}
export type SpendEntry = { attemptId: string; kind: 'reserve' | 'release' | 'spend'; cents: number; at: string }
export type ExecutionState = { schemaVersion: 1; version: number; releases: Record<string, ReleaseRecord>; attempts: Record<string, ExecutionAttempt>; ledger: SpendEntry[] }
export const emptyExecutionState = (): ExecutionState => ({ schemaVersion: 1, version: 0, releases: {}, attempts: {}, ledger: [] })
/** The entire read/check/claim/budget/receipt transition must commit atomically.
 * Implementations must roll back on throw and return detached values. No provider calls in a transaction. */
export interface CampaignTransactionStore {
  transaction<T>(change: (state: ExecutionState) => T): Promise<T>
  snapshot(): Promise<ExecutionState>
}
export type AttemptFence = { deliveryKey: string; owner: string; version: number }
export type Reconciliation = { callbackId: string; evidenceId: string; outcome: 'confirmed' | 'not_delivered' | 'uncertain'; receipt?: ActionReceipt; spentCents: number }
function clock(now: Date) { if (!Number.isFinite(now.getTime())) throw new Error('Invalid time.'); return now.toISOString() }
function money(value: number) { if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid spend.'); return value }
function authority(state: ExecutionState, releaseId: string, hash: string, now: Date) {
  clock(now)
  const record = state.releases[releaseId]
  if (!record || record.manifest.releaseId !== releaseId || record.hash !== hash || releaseHash(parseCampaignManifest(record.manifest)) !== hash) throw new Error('Exact-hash authority required.')
  if (record.state !== 'approved') throw new Error(`Release ${record.state}.`)
  if (Date.parse(record.manifest.createdAt) > +now || Date.parse(record.manifest.expiresAt) <= +now) throw new Error('Release expired or not yet valid.')
  return record
}
function currentAction(state: ExecutionState, attempt: ExecutionAttempt, now: Date) {
  const record = authority(state, attempt.releaseId, attempt.manifestHash, now)
  const action = record.manifest.actions.find(a => a.id === attempt.actionId)!
  if (Date.parse(action.evidenceExpiresAt) <= +now) throw new Error('Evidence expired; prepare a fresh packet.')
  return action
}
function fenced(state: ExecutionState, fence: AttemptFence, now: Date) {
  const attempt = state.attempts[fence.deliveryKey]
  if (!attempt || attempt.owner !== fence.owner || attempt.version !== fence.version) throw new Error('Ownership changed; reload.')
  if (Date.parse(attempt.leaseUntil) <= +now) throw new Error('Lease expired; reconcile ownership.')
  return attempt
}
function matches(action: CampaignReleaseAction, attempt: ExecutionAttempt, receipt: ActionReceipt) {
  return receipt.actionKey === attempt.deliveryKey && receipt.contentHash === attempt.contentHash && receipt.provider === action.provider && receipt.accountId === action.accountId && receipt.receiptType === action.expectedReceipt && Boolean(receipt.providerId.trim()) && Number.isFinite(Date.parse(receipt.receivedAt))
}
export class CampaignExecutionJournal {
  constructor(readonly store: CampaignTransactionStore) {}
  async prepare(record: ReleaseRecord) {
    return this.store.transaction(state => {
      const manifest = parseCampaignManifest(record.manifest)
      if (record.hash !== releaseHash(manifest) || record.state !== 'pending' || record.version !== 1 || record.audit.length) throw new Error('Prepare an unapproved exact packet.')
      const existing = state.releases[manifest.releaseId]
      if (existing && existing.hash !== record.hash) throw new Error('Immutable release identity conflict.')
      if (!existing) state.releases[manifest.releaseId] = { ...record, manifest }
      return state.releases[manifest.releaseId]
    })
  }
  async decide(releaseId: string, hash: string, decision: ReleaseDecision, actor: string, now: Date) {
    return this.store.transaction(state => {
      const record = state.releases[releaseId]
      if (!record) throw new Error('Release unavailable.')
      const next = decideCampaignRelease(record, hash, decision, actor, now)
      state.releases[releaseId] = next
      // Preserve reservations and submitted outcomes through stop. A receipt may still arrive.
      if (decision === 'stop') for (const attempt of Object.values(state.attempts).filter(a => a.releaseId === releaseId)) {
        if (attempt.state === 'claimed' || attempt.state === 'retryable') {
          state.ledger.push({ attemptId: attempt.id, kind: 'release', cents: attempt.reservedCents, at: clock(now) })
          attempt.reservedCents = 0; attempt.state = 'stopped'; attempt.version++
        }
      }
      return next
    })
  }
  async claim(input: { releaseId: string; hash: string; actionId: string; owner: string; now: Date }) {
    return this.store.transaction(state => {
      const { releaseId, hash, actionId, owner, now } = input
      if (!owner.trim()) throw new Error('Owner required.')
      const record = authority(state, releaseId, hash, now)
      const action = record.manifest.actions.find(a => a.id === actionId)
      if (!action) throw new Error('Unknown step.')
      if (Date.parse(action.evidenceExpiresAt) <= +now) throw new Error('Evidence expired.')
      if (Date.parse(action.scheduledFor) > +now) throw new Error('Schedule pending.')
      for (const depId of action.dependsOn) {
        const keys = campaignActionKeys(record.manifest, depId), dep = state.attempts[keys.deliveryKey]
        if (dep?.state !== 'confirmed' || dep.contentHash !== keys.contentHash) throw new Error('Dependency receipt required.')
      }
      const keys = campaignActionKeys(record.manifest, actionId)
      if (state.attempts[keys.deliveryKey]) throw new Error('Delivery already claimed; reconcile before retry.')
      const committed = Object.values(state.attempts).filter(a => a.releaseId === releaseId).reduce((sum, a) => sum + a.reservedCents + a.spentCents, 0)
      if (committed + money(action.maxSpendCents) > record.manifest.spendCapCents) throw new Error('Budget ceiling reached.')
      const attempt: ExecutionAttempt = { id: randomUUID(), releaseId, actionId, manifestHash: hash, ...keys,
        owner, version: 1, leaseUntil: new Date(+now + 60_000).toISOString(), state: 'claimed', tryCount: 1,
        reservedCents: action.maxSpendCents, spentCents: 0, events: [{ at: clock(now), kind: 'claimed' }], callbacks: {} }
      state.attempts[keys.deliveryKey] = attempt
      state.ledger.push({ attemptId: attempt.id, kind: 'reserve', cents: action.maxSpendCents, at: clock(now) })
      return attempt
    })
  }
  /** Persist before dispatch. A crash from this point is uncertain, never an automatic resend. */
  async submit(fence: AttemptFence, now: Date) {
    return this.store.transaction(state => {
      const attempt = fenced(state, fence, now)
      currentAction(state, attempt, now)
      if (attempt.state !== 'claimed') throw new Error('Step cannot submit.')
      attempt.state = 'submitted'; attempt.version++; attempt.events.push({ at: clock(now), kind: 'submitted' })
      return attempt
    })
  }
  /** After a lost worker, acquire a new fence. Expired submitted attempts keep their budget. */
  async recover(deliveryKey: string, expectedVersion: number, owner: string, now: Date) {
    return this.store.transaction(state => {
      clock(now)
      const attempt = state.attempts[deliveryKey]
      if (!owner.trim() || !attempt || attempt.version !== expectedVersion || Date.parse(attempt.leaseUntil) > +now) throw new Error('Recovery ownership unavailable.')
      if (['confirmed', 'stopped'].includes(attempt.state)) throw new Error('Terminal step.')
      // A pre-submit crash proves no dispatch through this contract. Retry still rechecks authority.
      if (attempt.state === 'claimed') attempt.state = 'retryable'
      if (attempt.state === 'submitted') attempt.state = 'reconciliation_required'
      attempt.owner = owner; attempt.version++; attempt.leaseUntil = new Date(+now + 60_000).toISOString()
      attempt.events.push({ at: clock(now), kind: 'recovered' })
      return attempt
    })
  }
  /** Only a trusted receipt verifier may call this. No browser or provider callback is wired. */
  async reconcile(fence: AttemptFence, evidence: Reconciliation, now: Date) {
    return this.store.transaction(state => {
      clock(now)
      const current = state.attempts[fence.deliveryKey]
      if (!current || !evidence.callbackId.trim() || !evidence.evidenceId.trim()) throw new Error('Verified reconciliation evidence required.')
      const digest = releaseHash(evidence)
      if (current.callbacks[evidence.callbackId]) {
        if (current.callbacks[evidence.callbackId] !== digest) throw new Error('Conflicting callback identity.')
        return current // exact redelivery is a no-op, even with the original fence
      }
      const attempt = fenced(state, fence, now)
      if (!['submitted', 'reconciliation_required'].includes(attempt.state)) throw new Error('Step is not awaiting reconciliation.')
      const record = state.releases[attempt.releaseId]
      const action = record.manifest.actions.find(a => a.id === attempt.actionId)!
      money(evidence.spentCents)
      if (evidence.spentCents > attempt.reservedCents) throw new Error('Receipt exceeds reserved budget; investigate.')
      if (evidence.outcome === 'confirmed') {
        if (!evidence.receipt || !matches(action, attempt, evidence.receipt)) throw new Error('Receipt does not match exact content and delivery.')
        attempt.receipt = evidence.receipt; attempt.state = 'confirmed'
      } else if (evidence.outcome === 'not_delivered') {
        if (evidence.receipt || evidence.spentCents !== 0) throw new Error('No-delivery proof cannot include a receipt or charge.')
        attempt.state = record.state === 'stopped' ? 'stopped' : 'retryable'
      } else {
        if (evidence.spentCents !== 0 || evidence.receipt) throw new Error('Uncertain outcomes retain the full reservation.')
        attempt.state = 'reconciliation_required'
      }
      if (evidence.outcome !== 'uncertain') {
        state.ledger.push({ attemptId: attempt.id, kind: 'release', cents: attempt.reservedCents, at: clock(now) })
        state.ledger.push({ attemptId: attempt.id, kind: 'spend', cents: evidence.spentCents, at: clock(now) })
        attempt.reservedCents = 0; attempt.spentCents += evidence.spentCents
      }
      attempt.callbacks[evidence.callbackId] = digest; attempt.version++
      attempt.events.push({ at: clock(now), kind: evidence.outcome, evidenceId: evidence.evidenceId })
      return attempt
    })
  }
  async retry(fence: AttemptFence, now: Date) {
    return this.store.transaction(state => {
      const attempt = fenced(state, fence, now), action = currentAction(state, attempt, now)
      if (attempt.state !== 'retryable' || attempt.tryCount >= 3) throw new Error('Retry unavailable; prepare operator recovery.')
      const record = state.releases[attempt.releaseId]
      const others = Object.values(state.attempts).filter(a => a.releaseId === attempt.releaseId && a.id !== attempt.id).reduce((sum, a) => sum + a.reservedCents + a.spentCents, 0)
      if (others + attempt.spentCents + action.maxSpendCents > record.manifest.spendCapCents) throw new Error('Budget ceiling reached.')
      if (attempt.reservedCents === 0) state.ledger.push({ attemptId: attempt.id, kind: 'reserve', cents: action.maxSpendCents, at: clock(now) })
      attempt.reservedCents = action.maxSpendCents; attempt.state = 'claimed'; attempt.tryCount++; attempt.version++
      attempt.events.push({ at: clock(now), kind: 'retry_claimed' })
      return attempt
    })
  }
}
export const attemptFence = (attempt: ExecutionAttempt): AttemptFence => ({ deliveryKey: attempt.deliveryKey, owner: attempt.owner, version: attempt.version })
