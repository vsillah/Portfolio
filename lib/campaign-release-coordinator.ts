import { actionIdempotencyKey, parseCampaignManifest, releaseHash, type CampaignReleaseAction, type ReleaseRecord } from './campaign-release-manifest'

export type ActionReceipt = { provider: CampaignReleaseAction['provider']; accountId: string; actionKey: string; receiptType: CampaignReleaseAction['expectedReceipt']; providerId: string; receivedAt: string }
export type ActionExecution = { key: string; state: 'claimed' | 'confirmed' | 'reconciliation_required'; receipt?: ActionReceipt; reason?: string }
export interface CampaignExecutionStore {
  /** Must read authoritative Portfolio state, not the Slack payload. */
  release(id: string): Promise<ReleaseRecord>
  /** Atomic globally unique claim; false means another release/worker already owns it. */
  claim(key: string): Promise<boolean>
  action(key: string): Promise<ActionExecution | null>
  settle(value: ActionExecution): Promise<void>
}
export interface CampaignExecutionAdapter {
  /** Includes source hash, exact account/copy/assets, current consent/suppression, hard spending cap,
   * and provider certification. No provider write is allowed during preflight. */
  preflight(action: CampaignReleaseAction): Promise<{ ready: boolean; reason?: string }>
  /** Adapter must repeat authority and emergency-stop checks at its existing durable provider claim.
   * A generic function that simply calls a provider is not a conforming adapter. */
  execute(action: CampaignReleaseAction, key: string, authority: { releaseId: string; manifestHash: string; expiresAt: string }): Promise<ActionReceipt>
}
export type CampaignExecutionResult = { actionId: string; status: 'blocked' | 'waiting' | 'confirmed' | 'reconciliation_required'; reason?: string }

function authorizationFailure(record: ReleaseRecord, expectedHash: string, now: Date): string | null {
  if (record.hash !== expectedHash || releaseHash(record.manifest) !== expectedHash) return 'Manifest changed; prepare a new release.'
  if (record.state !== 'approved') return `Release ${record.state}; execution blocked.`
  if (now.getTime() >= Date.parse(record.manifest.expiresAt)) return 'Release expired; prepare a new release.'
  if (now.getTime() < Date.parse(record.manifest.createdAt)) return 'Release authorization window has not started.'
  return null
}
function receiptMatches(action: CampaignReleaseAction, key: string, receipt: ActionReceipt): boolean {
  return receipt.provider === action.provider && receipt.accountId === action.accountId && receipt.actionKey === key
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
  parseCampaignManifest(initial.manifest)
  const results: CampaignExecutionResult[] = []
  for (const action of initial.manifest.actions) {
    const record = await input.store.release(input.releaseId)
    const blocked = authorizationFailure(record, input.expectedHash, now())
    if (blocked) { results.push({ actionId: action.id, status: 'blocked', reason: blocked }); continue }
    const key = actionIdempotencyKey(action)
    const previous = await input.store.action(key)
    if (previous) {
      results.push(previous.state === 'confirmed' && previous.receipt && receiptMatches(action, key, previous.receipt)
        ? { actionId: action.id, status: 'confirmed' }
        : { actionId: action.id, status: 'reconciliation_required', reason: 'An earlier attempt exists. Verify its provider receipt before any retry.' })
      continue
    }
    if (Date.parse(action.scheduledFor) > now().getTime()) { results.push({ actionId: action.id, status: 'waiting', reason: 'Scheduled time has not arrived.' }); continue }
    const dependencies = await Promise.all(action.dependsOn.map(async id => {
      const dependency = record.manifest.actions.find(candidate => candidate.id === id)!
      const depKey = actionIdempotencyKey(dependency), execution = await input.store.action(depKey)
      return execution?.state === 'confirmed' && execution.receipt && receiptMatches(dependency, depKey, execution.receipt)
    }))
    if (dependencies.some(confirmed => !confirmed)) { results.push({ actionId: action.id, status: 'waiting', reason: 'A required predecessor receipt is missing.' }); continue }
    const adapter = input.adapters?.[action.provider]
    if (!adapter) { results.push({ actionId: action.id, status: 'blocked', reason: 'Certified execution adapter unavailable. Review the existing channel gate in Portfolio.' }); continue }
    const gate = await adapter.preflight(action)
    if (!gate.ready) { results.push({ actionId: action.id, status: 'blocked', reason: gate.reason || 'Provider preflight blocked.' }); continue }
    const recheck = authorizationFailure(await input.store.release(input.releaseId), input.expectedHash, now())
    if (recheck) { results.push({ actionId: action.id, status: 'blocked', reason: recheck }); continue }
    if (!(await input.store.claim(key))) { results.push({ actionId: action.id, status: 'reconciliation_required', reason: 'Another worker owns this action. Read its receipt.' }); continue }
    try {
      const receipt = await adapter.execute(action, key, { releaseId: input.releaseId, manifestHash: input.expectedHash, expiresAt: record.manifest.expiresAt })
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
