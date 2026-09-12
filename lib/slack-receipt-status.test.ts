import { expect, it } from 'vitest'
import { slackReceiptStatus } from './slack-receipt-status'

const run = (state: string, outcome = {}) => ({ kind: 'slack_action_receipt', metadata: { state, envelope: { value: { action: 'warm_gmail_send.approve' } } }, outcome })
const canonical = { actionStatus: 'completed', text: 'Approval recorded. No email sent.' }

it.each([
  ['queued', {}, 'Decision queued', 'Slack update unconfirmed'],
  ['executing', {}, 'Processing decision', 'Slack update unconfirmed'],
  ['reconciliation_required', {}, 'Needs reconciliation', 'Slack update unconfirmed'],
  ['outcome', { canonical, delivery: 'failed' }, 'Decision recorded', 'Slack update pending retry'],
  ['delivery_blocked', { canonical, delivery: 'failed' }, 'Decision recorded', 'Slack update blocked'],
  ['delivered', { canonical, delivery: 'delivered' }, 'Decision recorded', 'Slack card updated'],
  ['delivered', { canonical }, 'Decision recorded', 'Slack update unconfirmed'],
  ['delivered', { canonical: { actionStatus: 'blocked' }, delivery: 'delivered' }, 'Decision blocked', 'Slack card updated'],
  ['delivered', { canonical: { actionStatus: 'failed' }, delivery: 'delivered' }, 'Decision failed', 'Slack card updated'],
  ['outcome', { canonical: { text: 'Legacy untyped result' } }, 'Outcome unconfirmed', 'Slack update unconfirmed'],
] as const)('separates decision and delivery evidence for %s', (state, outcome, decision, delivery) => {
  expect(slackReceiptStatus(run(state, outcome))).toMatchObject({ decision, delivery })
})

it('does not expose envelopes, private action text or transport locks', () => {
  expect(slackReceiptStatus({ kind: 'other' })).toBeNull()
  expect(slackReceiptStatus(run('message_lock'))).toBeNull()
  expect(slackReceiptStatus({ ...run('queued'), metadata: { state: 'queued', envelope: { value: { expectedReplyText: 'PRIVATE' }, user: 'PRIVATE' } } })).not.toHaveProperty('envelope')
  expect(JSON.stringify(slackReceiptStatus(run('queued')))).not.toContain('PRIVATE')
})

it.each([
  [{ action: 'warm_gmail_send.revise', contactId: 42 }, '/admin/outreach?tab=leads&filter=warm&id=42&contactId=42#warm-gmail-operating-loop'],
  [{ action: 'social_calendar.approve', calendarItemId: 'a&b' }, '/admin/agents/content-intelligence?section=calendar&calendar_item=a%26b'],
  [{ action: 'social_comment_reply.reject', commentId: 'c/1' }, '/admin/social-content/engagement-inbox?comment=c%2F1&review=reply&source=slack#social-comment-review-gate'],
])('links to the affected Portfolio review for %j', (value, reviewHref) => {
  expect(slackReceiptStatus({ ...run('queued'), metadata: { envelope: { value } } })?.reviewHref).toBe(reviewHref)
})

it('does not retain a repaired Slack error in the view or claim a provider send', () => {
  const status = slackReceiptStatus(run('delivered', { canonical, delivery: 'delivered', deliveryError: 'Old failure' }))!
  expect(status.deliveryError).toBeNull()
  expect(status.next).toContain('Provider delivery is tracked separately')
})

it('does not label other Slack actions as approval decisions', () => {
  expect(slackReceiptStatus({ ...run('delivered', { canonical, delivery: 'delivered' }),
    metadata: { state: 'delivered', envelope: { value: { action: 'work.ready' } } } }))
    .toMatchObject({ topic: 'Action', decision: 'Action completed' })
})
