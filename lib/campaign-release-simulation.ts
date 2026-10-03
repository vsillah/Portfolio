import { randomUUID } from 'node:crypto'
import { campaignActionKeys, parseCampaignManifest, releaseHash, type CampaignReleaseAction, type ReleaseRecord } from './campaign-release-manifest'
import type { ActionReceipt } from './campaign-release-coordinator'

export type SimulationAttempt = {
  id: string; owner: string; version: number; releaseId: string; authorizationKey: string; actionId: string;
  state: 'claimed' | 'confirmed' | 'uncertain' | 'not_dispatched'; reservedCents: number; spentCents: number;
  receipt?: ActionReceipt; events: Array<{ at: string; state: string; evidence?: string }>
}
export type SimulationState = { schema: 1; releases: Record<string, ReleaseRecord>; attempts: Record<string, SimulationAttempt[]> }
/** A single serializable transaction covers all releases, delivery claims and budget entries.
 * Production implementations must supply equivalent cross-worker durability before activation. */
export interface CampaignSimulationStore {
  transact<T>(fn: (state: SimulationState) => T): Promise<T>
}
export const emptySimulationState = (): SimulationState => ({ schema: 1, releases: {}, attempts: {} })
export type SimulationOutcome = { kind: 'confirmed'; spentCents: number } | { kind: 'uncertain' } | { kind: 'not_dispatched' }
export interface DisabledProviderAdapter {
  enabled: false; channel: string; reason: string
  preflight(): Promise<{ ready: false; reason: string }>
  execute(): Promise<never>
}
export const disabledCampaignAdapters: Readonly<Record<string, DisabledProviderAdapter>> = Object.freeze(Object.fromEntries(
  ['linkedin', 'instagram', 'facebook', 'x', 'tiktok', 'manual_social', 'heygen', 'youtube', 'gmail', 'slack', 'telnyx'].map(channel => [channel, Object.freeze({ enabled: false as const, channel,
    reason: channel === 'telnyx' ? 'SMS remains parked.' : 'Provider activation and certified execution storage required.',
    async preflight() { return { ready: false as const, reason: 'Provider execution disabled.' } },
    async execute(): Promise<never> { throw new Error('Provider execution disabled.') } })])))
const cents = (n: number) => Number.isSafeInteger(n) && n >= 0
const latest = (state: SimulationState, key: string) => state.attempts[key]?.at(-1)
function recordFor(state: SimulationState, releaseId: string, hash: string, now: Date) {
  const record = state.releases[releaseId]
  if (!record || record.hash !== hash || releaseHash(record.manifest) !== hash || record.state !== 'approved'
    || !Number.isFinite(now.getTime()) || Date.parse(record.manifest.createdAt) > +now || Date.parse(record.manifest.expiresAt) <= +now) throw new Error('Release authority unavailable, changed, stopped or expired.')
  return record
}
function matches(action: CampaignReleaseAction, key: string, receipt?: ActionReceipt) {
  return receipt?.actionKey === key && receipt.provider === action.provider && receipt.accountId === action.accountId
    && receipt.contentHash === releaseHash({ copy: action.copy, assets: action.assets }) && receipt.receiptType === action.expectedReceipt
    && receipt.providerId.startsWith('synthetic:') && Number.isFinite(Date.parse(receipt.receivedAt))
}
export function simulationBudget(state: SimulationState, releaseId: string) {
  return Object.values(state.attempts).flat().filter(attempt => attempt.releaseId === releaseId).reduce((sum, attempt) => ({
    reservedCents: sum.reservedCents + attempt.reservedCents, spentCents: sum.spentCents + attempt.spentCents,
  }), { reservedCents: 0, spentCents: 0 })
}
export async function saveSimulationRelease(store: CampaignSimulationStore, record: ReleaseRecord) {
  const manifest = parseCampaignManifest(record.manifest)
  if (record.hash !== releaseHash(manifest)) throw new Error('Packet integrity failure.')
  await store.transact(state => {
    const old = state.releases[manifest.releaseId]
    if (old && (old.hash !== record.hash || old.version > record.version || old.state === 'stopped'
      || (old.version === record.version && releaseHash(old) !== releaseHash(record)))) throw new Error('Stale or conflicting release decision.')
    state.releases[manifest.releaseId] = structuredClone({ ...record, manifest })
  })
}
export type SimulationClaim = { key: string; id: string; owner: string; version: number }
export async function claimSimulation(input: { store: CampaignSimulationStore; releaseId: string; hash: string; actionId: string; now: Date }): Promise<SimulationClaim> {
  return input.store.transact(state => {
    const record = recordFor(state, input.releaseId, input.hash, input.now)
    const action = record.manifest.actions.find(a => a.id === input.actionId)
    if (!action || Date.parse(action.scheduledFor) > +input.now || Date.parse(action.evidenceExpiresAt) <= +input.now) throw new Error('Action schedule or evidence blocked.')
    const { deliveryKey: key, authorizationKey } = campaignActionKeys(record.manifest, action.id)
    const previous = latest(state, key)
    if (previous && previous.state !== 'not_dispatched') throw new Error('Delivery already claimed; reconcile without resending.')
    for (const id of action.dependsOn) {
      const dep = record.manifest.actions.find(a => a.id === id)!
      const depKey = campaignActionKeys(record.manifest, id).deliveryKey, attempt = latest(state, depKey)
      if (attempt?.state !== 'confirmed' || !matches(dep, depKey, attempt.receipt)) throw new Error('Required predecessor receipt missing or mismatched.')
    }
    const budget = simulationBudget(state, input.releaseId)
    if (budget.reservedCents + budget.spentCents + action.maxSpendCents > record.manifest.spendCapCents) throw new Error('Release spending ceiling exceeded.')
    const attempt: SimulationAttempt = { id: randomUUID(), owner: randomUUID(), version: 1, releaseId: input.releaseId, authorizationKey, actionId: action.id,
      state: 'claimed', reservedCents: action.maxSpendCents, spentCents: 0, events: [{ at: input.now.toISOString(), state: 'claimed' }] }
    ;(state.attempts[key] ??= []).push(attempt)
    return { key, id: attempt.id, owner: attempt.owner, version: attempt.version }
  })
}
/** Pure simulator: no callback, SDK, fetch, credentials or provider adapter can be injected. */
export async function settleSimulation(input: { store: CampaignSimulationStore; claim: SimulationClaim; outcome: SimulationOutcome; now: Date }) {
  return input.store.transact(state => {
    const attempt = latest(state, input.claim.key)
    if (!attempt || attempt.id !== input.claim.id || attempt.owner !== input.claim.owner || attempt.version !== input.claim.version || attempt.state !== 'claimed') throw new Error('Stale attempt owner or version.')
    const record = state.releases[attempt.releaseId], action = record.manifest.actions.find(a => a.id === attempt.actionId)!
    const authorityCurrent = record.state === 'approved' && +input.now < Date.parse(record.manifest.expiresAt) && +input.now < Date.parse(action.evidenceExpiresAt)
    const outcome = authorityCurrent ? input.outcome : { kind: 'uncertain' as const }
    if (!Number.isFinite(+input.now)) throw new Error('Invalid settlement time.')
    if (outcome.kind === 'confirmed') {
      if (!cents(outcome.spentCents) || outcome.spentCents > attempt.reservedCents) throw new Error('Spend exceeds reservation.')
      attempt.receipt = { provider: action.provider, accountId: action.accountId, actionKey: input.claim.key,
        contentHash: releaseHash({ copy: action.copy, assets: action.assets }), receiptType: action.expectedReceipt,
        providerId: `synthetic:${attempt.id}`, receivedAt: input.now.toISOString() }
      attempt.spentCents = outcome.spentCents; attempt.reservedCents = 0
    } else if (outcome.kind === 'not_dispatched') attempt.reservedCents = 0
    attempt.state = outcome.kind; attempt.version++
    attempt.events.push({ at: input.now.toISOString(), state: outcome.kind })
    return structuredClone(attempt)
  })
}
/** Reconciliation attaches bounded synthetic evidence; it never dispatches or frees an uncertain claim. */
export async function reconcileSimulation(input: { store: CampaignSimulationStore; key: string; version: number; receipt: ActionReceipt; spentCents: number; evidence: string; now: Date }) {
  return input.store.transact(state => {
    const attempt = latest(state, input.key)
    if (!attempt || !['claimed', 'uncertain'].includes(attempt.state) || attempt.version !== input.version) throw new Error('Reconciliation version changed.')
    const record = state.releases[attempt.releaseId], action = record.manifest.actions.find(a => a.id === attempt.actionId)!
    if (!matches(action, input.key, input.receipt) || !input.evidence.trim() || !Number.isFinite(+input.now)
      || !cents(input.spentCents) || input.spentCents > attempt.reservedCents) throw new Error('Reconciliation evidence or spending invalid.')
    attempt.state = 'confirmed'; attempt.receipt = structuredClone(input.receipt); attempt.spentCents = input.spentCents; attempt.reservedCents = 0; attempt.version++
    attempt.events.push({ at: input.now.toISOString(), state: 'confirmed', evidence: input.evidence })
    return structuredClone(attempt)
  })
}
export function simulationRetry(attempt?: SimulationAttempt) {
  if (!attempt) return 'ready' as const
  return attempt.state === 'not_dispatched' ? 'retry_safe' as const : attempt.state === 'confirmed' ? 'complete' as const : 'reconcile' as const
}
