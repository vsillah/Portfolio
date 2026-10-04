import type { CampaignJournalRpc } from './campaign-release-durable-store'
import type { ExecutionAttempt } from './campaign-release-execution'
import { releaseHash } from './campaign-release-manifest'

export type AtomicRecoveryCommand = {
  commandId: string; operation: 'inspect' | 'renew' | 'reconcile' | 'release' | 'review_takeover' | 'takeover'
  releaseId: string; hash: string; deliveryKey: string; authorizationKey: string; contentHash: string
  attemptId: string; intentId: string; owner: string; expectedVersion: number
  newOwner?: string; reviewCommandId?: string; reviewNote?: string
}
export type AtomicRecoveryResult = {
  protocol: 'campaign-atomic-recovery/v1'; providerEnabled: false; dispatched: false
  commandId: string; requestDigest: string
  outcome: 'inspected' | 'renewed' | 'reconciliation_required' | 'released' | 'takeover_reviewed' | 'takeover'
  eligible: boolean; noInvocationProven: boolean; reason: string
  attempt: ExecutionAttempt; journalVersion: number; checkedAt: string
}
/** Explicit commands only. Historical duplicate results are receipts, never permits.
 * Actor is supplied by an authenticated server factory, never a browser field.
 * No automatic retries, provider transports or worker registration. */
export class AtomicCampaignRecovery {
  constructor(private readonly client: CampaignJournalRpc, private readonly actor: string) {
    if (!/^portfolio:[^\s]+$/.test(actor)) throw new Error('Authenticated Portfolio recovery actor required.')
  }
  async execute(command: AtomicRecoveryCommand): Promise<AtomicRecoveryResult> {
    const request = { ...command, actor: this.actor }
    let response
    try { response = await this.client.rpc('campaign_recover_atomic_intent', { request }) }
    catch { throw new Error('Recovery commit uncertain. Inspect the exact intent; do not automatically retry.') }
    if (response.error) throw new Error('Recovery refused or unavailable. Inspect the exact intent; providers remain disabled.')
    const result = response.data as AtomicRecoveryResult | null
    const attempt = result?.attempt
    if (!result || result.protocol !== 'campaign-atomic-recovery/v1' || result.providerEnabled !== false || result.dispatched !== false ||
      result.commandId !== command.commandId || result.requestDigest !== releaseHash(request) ||
      !['inspected','renewed','reconciliation_required','released','takeover_reviewed','takeover'].includes(result.outcome) ||
      typeof result.eligible !== 'boolean' || typeof result.noInvocationProven !== 'boolean' || typeof result.reason !== 'string' ||
      !Number.isSafeInteger(result.journalVersion) || result.journalVersion < 0 || !Number.isFinite(Date.parse(result.checkedAt)) ||
      !attempt || attempt.id !== command.attemptId || attempt.releaseId !== command.releaseId || attempt.manifestHash !== command.hash ||
      attempt.deliveryKey !== command.deliveryKey || attempt.authorizationKey !== command.authorizationKey || attempt.contentHash !== command.contentHash ||
      attempt.dispatchIntent?.id !== command.intentId || !attempt.dispatchIntent.atomicRequest ||
      !Number.isSafeInteger(attempt.version) || attempt.version < 1 || !Number.isSafeInteger(attempt.reservedCents) || attempt.reservedCents < 0 ||
      !Number.isSafeInteger(attempt.spentCents) || attempt.spentCents < 0 || !Array.isArray(attempt.events)) {
      throw new Error('Recovery response ambiguous. Providers remain disabled.')
    }
    const allowed: Record<AtomicRecoveryCommand['operation'], AtomicRecoveryResult['outcome'][]> = {
      inspect: ['inspected'], renew: ['renewed', 'reconciliation_required'],
      reconcile: ['reconciliation_required'], release: ['released', 'reconciliation_required'],
      review_takeover: ['takeover_reviewed', 'reconciliation_required'], takeover: ['takeover', 'reconciliation_required'],
    }
    if (!allowed[command.operation]?.includes(result.outcome) ||
      (command.operation !== 'inspect' && attempt.owner !== (result.outcome === 'takeover' ? command.newOwner : command.owner)) ||
      (['renewed', 'takeover'].includes(result.outcome) && (!result.eligible || !result.noInvocationProven ||
        attempt.state !== 'claimed' || attempt.version !== command.expectedVersion + 1 ||
        attempt.dispatchIntent.mode !== 'disabled' || attempt.dispatchIntent.status !== 'prepared')) ||
      (result.outcome === 'released' && (!result.noInvocationProven || attempt.state !== 'stopped' || attempt.reservedCents !== 0)) ||
      (result.outcome === 'reconciliation_required' && !['reconciliation_required', 'stopped'].includes(attempt.state))) {
      throw new Error('Recovery outcome ambiguous. Providers remain disabled.')
    }
    return structuredClone(result)
  }
}
