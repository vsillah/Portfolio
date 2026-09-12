/** This request was rejected before its external mutation/delivery action was attempted. */
export const CONFIRMED_PREFLIGHT_REJECTION = 'rejected_before_external_action' as const
export function isConfirmedPreflightRejection(result: Record<string, unknown>): boolean {
  return result.actionOutcome === CONFIRMED_PREFLIGHT_REJECTION && result.uncertain !== true &&
    result.gmailSendCalled !== true && result.externalSendPerformed !== true && result.sent !== true &&
    result.gmailDraftCreated !== true && result.gmailDraftUpdated !== true && result.duplicatePrevented !== true
}
