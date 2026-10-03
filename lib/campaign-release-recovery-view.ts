import type { ApprovalBinding } from './campaign-release-activation'
import type { ReceiptTrust } from './campaign-release-receipts'
import type { ReleaseRecord } from './campaign-release-manifest'
import type { ExecutionAttempt } from './campaign-release-execution'

export type SyntheticExecutionProgress = Pick<ExecutionAttempt, 'releaseId' | 'manifestHash' | 'actionId' | 'state' | 'tryCount' | 'reservedCents' | 'spentCents'> & { mode: 'synthetic'; receiptId: string | null; receiptTrust?: ReceiptTrust }
/** Call on the server before serialization. Never expose ownership, callbacks or audit payloads. */
export function syntheticExecutionProgress(record: ReleaseRecord, attempts: ExecutionAttempt[]): SyntheticExecutionProgress[] {
  return attempts.filter(a => a.releaseId === record.manifest.releaseId && a.manifestHash === record.hash && record.manifest.actions.some(step => step.id === a.actionId)).map(a => ({
    mode: 'synthetic', releaseId: a.releaseId, manifestHash: a.manifestHash, actionId: a.actionId, state: a.state === 'confirmed' && (a.verification?.mode !== 'sandbox' && (a.receipt?.trust !== 'synthetic' || !a.receipt.providerId.startsWith('synthetic:'))) ? 'reconciliation_required' : a.state,
    tryCount: a.tryCount, reservedCents: a.reservedCents, spentCents: a.spentCents,
    receiptTrust: a.verification?.trust ?? a.receipt?.trust,
    receiptId: a.verification?.mode === 'sandbox' ? a.verification.providerId.slice(0, 200) : a.receipt?.trust === 'synthetic' && a.receipt.providerId.startsWith('synthetic:') ? a.receipt.providerId.slice(0, 200) : null,
  }))
}
export type ReleaseRecoveryStep = { actionId: string; state: string; detail: string; receipt: string | null; trust: string; attempts: number; reservedCents: number; spentCents: number }
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
    return { actionId: action.id, state, detail, trust: attempt?.receiptTrust ? receiptTrustLabel[attempt.receiptTrust] : 'No verified receipt', receipt: attempt?.receiptId ?? null, attempts: attempt?.tryCount ?? 0, reservedCents: attempt?.reservedCents ?? 0, spentCents: attempt?.spentCents ?? 0 }
  })
}

const receiptTrustLabel: Record<ReceiptTrust, string> = {
  synthetic: 'Synthetic confirmation', locally_verified: 'Locally verified only', provider_accepted: 'Provider accepted · sandbox',
  provider_confirmed: 'Provider confirmed · sandbox', rejected: 'Rejected / no delivery · sandbox', uncertain: 'Uncertain · sandbox',
}
export type ApprovalProgress = Pick<ApprovalBinding, 'releaseId' | 'manifestHash' | 'approvalVersion' | 'status' | 'checkedAt'>
export function campaignReadiness(record: ReleaseRecord, bindings: ApprovalProgress[] = [], now = Date.now(), attempts: SyntheticExecutionProgress[] = []) {
  const valid = Number.isFinite(now) && Date.parse(record.manifest.createdAt) <= now && Date.parse(record.manifest.expiresAt) > now && record.manifest.actions.every(a => Date.parse(a.evidenceExpiresAt) > now)
  const binding = bindings.find(b => b.releaseId === record.manifest.releaseId)
  const matches = binding?.manifestHash === record.hash && binding?.approvalVersion === record.version
  const approved = valid && record.state === 'approved'
  const bound = approved && matches && binding?.status === 'bound'
  const uncertain = attempts.some(a => a.releaseId === record.manifest.releaseId && a.manifestHash === record.hash && ['submitted', 'reconciliation_required'].includes(a.state))
  return {
    approval: !valid ? 'Expired / unavailable' : record.state.replaceAll('_', ' '),
    persistence: bound ? 'Approval bound · review only' : binding ? 'Binding stale / unconfirmed' : 'Journal not connected',
    delivery: 'Disabled',
    nextAction: !valid || ['held', 'revision_requested', 'stopped'].includes(record.state) ? 'Prepare a fresh release packet.' : !approved ? 'Review content and approve this exact packet.' : uncertain ? 'Review uncertain receipts before any retry.' : !bound ? 'Captain: qualify the approval binding in staging.' : 'Captain: certify canonical dispatch fencing and provider receipts.',
  }
}
