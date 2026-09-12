// Client-safe projection of persisted receipts. Never infer a provider send from a decision.
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export function slackReceiptStatus(run: Record<string, unknown>) {
  if (run.kind !== 'slack_action_receipt') return null
  const metadata = record(run.metadata), outcome = record(run.outcome)
  if (metadata.state === 'message_lock') return null
  const canonical = record(outcome.canonical)
  const value = record(record(metadata.envelope).value)
  const topic = ['approval.', 'warm_gmail_send.', 'social_calendar.', 'social_calendar_draft_handoff.', 'social_comment_reply.']
    .some(prefix => String(value.action).startsWith(prefix)) ? 'Decision' : 'Action'
  const confirmed = ['completed', 'already_recorded'].includes(String(canonical.actionStatus))
  const decision = metadata.state === 'reconciliation_required' ? 'Needs reconciliation'
    : confirmed ? topic === 'Decision' ? 'Decision recorded' : 'Action completed'
      : canonical.actionStatus === 'blocked' ? `${topic} blocked`
        : canonical.actionStatus === 'failed' ? `${topic} failed`
          : metadata.state === 'executing' ? `Processing ${topic.toLowerCase()}`
            : ['queued', 'claimed'].includes(String(metadata.state)) ? `${topic} queued` : 'Outcome unconfirmed'
  const delivery = metadata.state === 'delivered' && outcome.delivery === 'delivered' ? 'Slack card updated'
    : metadata.state === 'delivery_blocked' ? 'Slack update blocked'
      : outcome.delivery === 'failed' ? 'Slack update pending retry'
        : metadata.state === 'delivering' ? 'Updating Slack card' : 'Slack update unconfirmed'
  const next = metadata.state === 'reconciliation_required'
    ? 'Review the saved decision before retrying.'
    : metadata.state === 'delivery_blocked'
      ? 'Review the delivery details and repair Slack access or card identity; keep the saved decision.'
      : outcome.delivery === 'failed'
        ? 'Feedback will retry automatically while receipt processing is enabled. Keep the saved decision.'
        : confirmed ? 'Review the decision in Portfolio. Provider delivery is tracked separately.'
          : 'Refresh for the saved outcome; review in Portfolio before repeating the action.'
  let reviewHref = '/admin/agents'
  if (String(value.action).startsWith('warm_gmail_send.') && Number.isSafeInteger(value.contactId) && Number(value.contactId) > 0) {
    reviewHref = `/admin/outreach?tab=leads&filter=warm&id=${value.contactId}&contactId=${value.contactId}#warm-gmail-operating-loop`
  } else if (String(value.action).startsWith('social_calendar') && typeof value.calendarItemId === 'string') {
    reviewHref = `/admin/agents/content-intelligence?section=calendar&calendar_item=${encodeURIComponent(value.calendarItemId)}`
  } else if (String(value.action).startsWith('social_comment_reply.') && typeof value.commentId === 'string') {
    reviewHref = `/admin/social-content/engagement-inbox?comment=${encodeURIComponent(value.commentId)}&review=reply&source=slack#social-comment-review-gate`
  }
  return { topic, decision, delivery, next, reviewHref,
    text: typeof canonical.text === 'string' ? canonical.text : null,
    deliveryError: typeof outcome.deliveryError === 'string' && outcome.delivery !== 'delivered' ? outcome.deliveryError : null }
}
