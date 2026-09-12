import { validateSocialContentFinalCopyQuality } from './social-content-lifecycle'

/** Deterministic preflight; human review still decides whether the copy is appropriate. */
export function warmCopyBlocker(body: unknown): string | null {
  if (typeof body !== 'string' || !body.trim()) return 'Write final message copy before review.'
  if (validateSocialContentFinalCopyQuality({ post_text: body }).status === 'blocked') return 'Replace planning instructions with recipient-ready copy.'
  if (body.length > 20000) return 'Shorten the message to 20,000 characters.'
  if (/draft direction:|safe mention:|the warm basis is|blocked for .*:|reviewing the .* context in portfolio/i.test(body)) {
    return 'Replace planning instructions with recipient-ready copy.'
  }
  if (/\[(?:insert|recipient|first.name|your.name|company|placeholder)[^\]]*\]|\{\{[^}]+\}\}/i.test(body)) {
    return 'Replace placeholders before review.'
  }
  return null
}

export function warmCopyEvidenceBlocker(inputs: Record<string, unknown> | null | undefined): string | null {
  const reviewDelivery = inputs?.warm_gmail_review_slack_delivery as Record<string, unknown> | undefined
  if (reviewDelivery && reviewDelivery.state !== 'sent') return 'Reconcile the existing Slack review delivery before changing or retrying this message.'
  const draftAttempt = inputs?.warm_gmail_draft_creation_attempt as Record<string, unknown> | undefined
  if (draftAttempt && draftAttempt.status !== 'tracked') return 'Reconcile the existing mailbox draft attempt before changing or retrying this message.'
  const execution = inputs?.warm_gmail_send_execution as Record<string, unknown> | undefined
  if (execution && !['eligible', 'eligible_for_execution', 'blocked', 'blocked_no_send', 'not_requested', 'failed_before_provider_call'].includes(String(execution.state ?? execution.status ?? ''))) {
    return 'Reconcile the existing provider attempt before changing or retrying this message.'
  }
  return null
}
