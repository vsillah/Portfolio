/** Client/server contract for an explicit, displayed Gmail confirmation. */
export type WarmGmailReviewedCopy = {
  queueId: string
  recipientEmail: string
  sender: string
  subject: string
  body: string
  updatedAt: string
}
export type WarmGmailActionReadiness = {
  reviewedCopy: WarmGmailReviewedCopy
  expectedAuthorization: Record<string, unknown>
  readyForConfirmation?: boolean
  noSendSmoke?: boolean
  slackDestination?: { workspaceId: string; channelId: string }
}
export function buildWarmGmailActionRequest(
  action: 'draft' | 'update' | 'send' | 'slack',
  readiness: WarmGmailActionReadiness,
  displayed: { id: string; updatedAt?: string; subject: string | null; body: string | null },
) {
  const copy = readiness.reviewedCopy
  const authorization = readiness.expectedAuthorization
  if (!copy || !authorization || copy.queueId !== displayed.id || copy.updatedAt !== displayed.updatedAt ||
    copy.subject !== (displayed.subject ?? '') || copy.body !== (displayed.body ?? '') ||
    !copy.recipientEmail || !copy.sender || authorization.recipientEmail !== copy.recipientEmail ||
    authorization.expectedUpdatedAt !== copy.updatedAt || typeof authorization.finalCopyFingerprint !== 'string' ||
    !authorization.finalCopyFingerprint.startsWith('warm-final-copy:v1:')) {
    throw new Error('The reviewed message changed. Refresh and review the confirmation again.')
  }
  if (action === 'draft' || action === 'update' ? readiness.noSendSmoke !== true || (action === 'draft' ? authorization.createGmailDraft !== true : authorization.updateGmailDraft !== true || typeof authorization.gmailDraftId !== 'string') :
    readiness.readyForConfirmation !== true || (action === 'send' ? authorization.executeGmailSend !== true : authorization.sendReviewToSlack !== true || authorization.workspaceId !== readiness.slackDestination?.workspaceId || authorization.channelId !== readiness.slackDestination?.channelId)) {
    throw new Error('This Gmail action is not ready. Refresh readiness after resolving the blocker.')
  }
  return { ...authorization }
}
