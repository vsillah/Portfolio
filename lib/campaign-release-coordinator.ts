import type { ReceiptTrust } from './campaign-release-receipts'
import { campaignActionKeys, actionIdempotencyKey, parseCampaignManifest, releaseHash, type CampaignReleaseAction, type ReleaseRecord } from './campaign-release-manifest'

export type ActionReceipt = { trust?: ReceiptTrust; provider: CampaignReleaseAction['provider']; accountId: string; actionKey: string; contentHash: string; receiptType: CampaignReleaseAction['expectedReceipt']; providerId: string; receivedAt: string }
export type ActionExecution = { key: string; state: 'claimed' | 'confirmed' | 'reconciliation_required'; receipt?: ActionReceipt; reason?: string }
export type ClaimAuthority = { releaseId: string; manifestHash: string; authorizationKey: string; expiresAt: string; evidenceExpiresAt: string; maxSpendCents: number; spendCapCents: number }
export type CampaignPreflight = { ready: boolean; reason?: string; providerGateSatisfied: boolean; consentAndSuppressionCurrent: boolean; reservedSpendCents: number }
export interface CampaignExecutionStore {
  /** Must read authoritative Portfolio state, not the Slack payload. */
  release(id: string): Promise<ReleaseRecord>
  /** Atomically reserve budget and claim the globally unique delivery key; recheck exact
   * authority/stop/expiry. false means duplicate, stale authority or insufficient budget. */
  claim(key: string, authority: ClaimAuthority): Promise<boolean>
  action(key: string): Promise<ActionExecution | null>
  settle(value: ActionExecution): Promise<void>
}
export interface CampaignExecutionAdapter {
  /** Includes source hash, exact account/copy/assets, current consent/suppression, hard spending cap,
   * and provider certification. No provider write is allowed during preflight. */
  preflight(action: CampaignReleaseAction): Promise<CampaignPreflight>
  /** Adapter must repeat authority and emergency-stop checks at its existing durable provider claim.
   * A generic function that simply calls a provider is not a conforming adapter. */
  execute(action: CampaignReleaseAction, key: string, authority: ClaimAuthority): Promise<ActionReceipt>
}
export type CampaignExecutionResult = { actionId: string; status: 'blocked' | 'waiting' | 'confirmed' | 'reconciliation_required'; reason?: string }

function authorizationFailure(record: ReleaseRecord, expectedHash: string, now: Date): string | null {
  if (!Number.isFinite(now.getTime())) return 'Invalid execution time.'
  if (record.hash !== expectedHash || releaseHash(record.manifest) !== expectedHash) return 'Manifest changed; prepare a new release.'
  if (record.state !== 'approved') return `Release ${record.state}; execution blocked.`
  if (now.getTime() >= Date.parse(record.manifest.expiresAt)) return 'Release expired; prepare a new release.'
  if (now.getTime() < Date.parse(record.manifest.createdAt)) return 'Release authorization window has not started.'
  return null
}
function receiptMatches(action: CampaignReleaseAction, key: string, receipt: ActionReceipt): boolean {
  return receipt.provider === action.provider && receipt.accountId === action.accountId && receipt.actionKey === key
    && receipt.contentHash === releaseHash({ copy: action.copy, assets: action.assets })
    && receipt.receiptType === action.expectedReceipt && Boolean(receipt.providerId.trim()) && Number.isFinite(Date.parse(receipt.receivedAt))
}

/** No production adapters are registered. This coordinator cannot itself make network requests.
 * Uncertain attempts are never automatically retried, including process crashes after claim. */
export async function coordinateCampaignRelease(input: {
  releaseId: string; expectedHash: string; store: CampaignExecutionStore;
  adapters?: Partial<Record<CampaignReleaseAction['provider'], CampaignExecutionAdapter>>;
  now?: () => Date;
}): Promise<CampaignExecutionResult[]> {
  const now = input.now ?? (() => new Date())
  const initial = await input.store.release(input.releaseId)
  const snapshot = parseCampaignManifest(initial.manifest)
  // Never iterate caller-owned state or accept a different initial packet under a later hash.
  if (snapshot.releaseId !== input.releaseId || releaseHash(snapshot) !== input.expectedHash) {
    return snapshot.actions.map(action => ({ actionId: action.id, status: 'blocked', reason: 'Manifest changed; prepare a new release.' }))
  }
  const results: CampaignExecutionResult[] = []
  for (const action of snapshot.actions) {
    const record = await input.store.release(input.releaseId)
    const blocked = authorizationFailure(record, input.expectedHash, now())
    if (blocked) { results.push({ actionId: action.id, status: 'blocked', reason: blocked }); continue }
    const { deliveryKey: key, authorizationKey } = campaignActionKeys(snapshot, action.id)
    const previous = await input.store.action(key)
    if (previous) {
      results.push(previous.state === 'confirmed' && previous.receipt && receiptMatches(action, key, previous.receipt)
        ? { actionId: action.id, status: 'confirmed' }
        : { actionId: action.id, status: 'reconciliation_required', reason: 'An earlier attempt exists. Verify its provider receipt before any retry.' })
      continue
    }
    if (Date.parse(action.scheduledFor) > now().getTime()) { results.push({ actionId: action.id, status: 'waiting', reason: 'Scheduled time has not arrived.' }); continue }
    if (now().getTime() >= Date.parse(action.evidenceExpiresAt)) { results.push({ actionId: action.id, status: 'blocked', reason: 'Consent/suppression evidence expired; prepare a new release.' }); continue }
    const dependencies = await Promise.all(action.dependsOn.map(async id => {
      const dependency = snapshot.actions.find(candidate => candidate.id === id)!
      const depKey = actionIdempotencyKey(dependency), execution = await input.store.action(depKey)
      return execution?.state === 'confirmed' && execution.receipt && receiptMatches(dependency, depKey, execution.receipt)
    }))
    if (dependencies.some(confirmed => !confirmed)) { results.push({ actionId: action.id, status: 'waiting', reason: 'A required predecessor receipt is missing.' }); continue }
    const adapter = input.adapters?.[action.provider]
    if (!adapter) { results.push({ actionId: action.id, status: 'blocked', reason: 'Certified execution adapter unavailable. Review the existing channel gate in Portfolio.' }); continue }
    const gate = await adapter.preflight(action)
    if (!gate.ready || !gate.providerGateSatisfied || !gate.consentAndSuppressionCurrent) { results.push({ actionId: action.id, status: 'blocked', reason: gate.reason || 'Provider preflight blocked.' }); continue }
    if (!Number.isSafeInteger(gate.reservedSpendCents) || gate.reservedSpendCents < 0 || gate.reservedSpendCents + action.maxSpendCents > snapshot.spendCapCents) { results.push({ actionId: action.id, status: 'blocked', reason: 'Spending cap exceeded or budget evidence invalid.' }); continue }
    const recheck = authorizationFailure(await input.store.release(input.releaseId), input.expectedHash, now())
    if (recheck || now().getTime() >= Date.parse(action.evidenceExpiresAt)) { results.push({ actionId: action.id, status: 'blocked', reason: recheck || 'Consent/suppression evidence expired during preflight.' }); continue }
    const authority: ClaimAuthority = Object.freeze({ releaseId: input.releaseId, manifestHash: input.expectedHash, authorizationKey, expiresAt: snapshot.expiresAt, evidenceExpiresAt: action.evidenceExpiresAt, maxSpendCents: action.maxSpendCents, spendCapCents: snapshot.spendCapCents })
    if (!(await input.store.claim(key, authority))) { results.push({ actionId: action.id, status: 'reconciliation_required', reason: 'Claim or budget reservation refused. Reconcile authoritative state before retry.' }); continue }
    try {
      const dispatchBlocker = authorizationFailure(await input.store.release(input.releaseId), input.expectedHash, now())
      if (dispatchBlocker || now().getTime() >= Date.parse(action.evidenceExpiresAt)) throw new Error('Authority expired or stopped after claim; reconcile reserved state.')
      const receipt = await adapter.execute(action, key, authority)
      if (!receiptMatches(action, key, receipt)) throw new Error('Provider receipt did not match the authorized action.')
      await input.store.settle({ key, state: 'confirmed', receipt })
      results.push({ actionId: action.id, status: 'confirmed' })
    } catch {
      // Even a thrown request can have succeeded remotely. Keep the claim, never release it.
      await input.store.settle({ key, state: 'reconciliation_required', reason: 'Provider outcome unconfirmed. Reconcile before retry.' })
      results.push({ actionId: action.id, status: 'reconciliation_required', reason: 'Provider outcome unconfirmed. Reconcile before retry.' })
      break
    }
  }
  return results
}
