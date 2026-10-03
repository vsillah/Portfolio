import type { ReleaseRecord } from './campaign-release-manifest'
import type { ExecutionAttempt } from './campaign-release-execution'

export type SyntheticExecutionProgress = Pick<ExecutionAttempt, 'releaseId' | 'manifestHash' | 'actionId' | 'state' | 'tryCount' | 'reservedCents' | 'spentCents'> & { mode: 'synthetic'; receiptId: string | null }
/** Call on the server before serialization. Never expose ownership, callbacks or audit payloads. */
export function syntheticExecutionProgress(record: ReleaseRecord, attempts: ExecutionAttempt[]): SyntheticExecutionProgress[] {
  return attempts.filter(a => a.releaseId === record.manifest.releaseId && a.manifestHash === record.hash && record.manifest.actions.some(step => step.id === a.actionId)).map(a => ({
    mode: 'synthetic', releaseId: a.releaseId, manifestHash: a.manifestHash, actionId: a.actionId, state: a.state,
    tryCount: a.tryCount, reservedCents: a.reservedCents, spentCents: a.spentCents,
    receiptId: a.receipt?.providerId.startsWith('synthetic:') ? a.receipt.providerId.slice(0, 200) : null,
  }))
}
export type ReleaseRecoveryStep = { actionId: string; state: string; detail: string; receipt: string | null; attempts: number; reservedCents: number; spentCents: number }
/** Serializable projection only; importing this in a client never loads crypto or filesystem code. */
export function campaignRecoveryView(record: ReleaseRecord, attempts: SyntheticExecutionProgress[] = [], now = Date.now()): ReleaseRecoveryStep[] {
  return record.manifest.actions.map(action => {
    const attempt = attempts.find(row => row.mode === 'synthetic' && row.releaseId === record.manifest.releaseId && row.manifestHash === record.hash && row.actionId === action.id)
    let state = 'Provider disabled', detail = 'Complete channel certification with the captain.'
    if (attempt) {
      state = ({ claimed: 'Reserved', submitted: 'Awaiting receipt', confirmed: 'Synthetic receipt confirmed', retryable: 'Retry eligible', reconciliation_required: 'Reconcile outcome', stopped: 'Stopped' })[attempt.state]
      detail = ({ claimed: 'Reservation held. No provider dispatch is enabled.', submitted: 'Keep the reservation. Verify delivery before retrying.', confirmed: 'Simulation only. No provider delivery occurred.', retryable: 'No delivery established. Refresh authority and budget before a bounded retry.', reconciliation_required: 'Verify the provider receipt or obtain no-delivery evidence. Do not resend.', stopped: 'Prepare a new packet if work should continue.' })[attempt.state]
    } else if (record.state === 'stopped') { state = 'Stopped'; detail = 'This release cannot resume.' }
    else if (Date.parse(action.evidenceExpiresAt) <= now || Date.parse(record.manifest.expiresAt) <= now) { state = 'Evidence expired'; detail = 'Update channel checks and prepare a fresh packet.' }
    else if (action.dependsOn.some(id => !attempts.some(row => row.mode === 'synthetic' && row.releaseId === record.manifest.releaseId && row.manifestHash === record.hash && row.actionId === id && row.state === 'confirmed'))) { state = 'Waiting on dependency'; detail = `${action.dependsOn.length} required predecessor receipt(s).` }
    else if (record.state !== 'approved') { state = 'Review required'; detail = 'Review content and scope before approving this packet.' }
    return { actionId: action.id, state, detail, receipt: attempt?.receiptId ?? null, attempts: attempt?.tryCount ?? 0, reservedCents: attempt?.reservedCents ?? 0, spentCents: attempt?.spentCents ?? 0 }
  })
}
