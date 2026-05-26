import { describe, expect, it } from 'vitest'
import { parseArgs, planReplyIntentReviewSync } from './sync-reply-intent-review-candidates'

describe('sync reply-intent review candidates script', () => {
  it('parses dry-run and apply options', () => {
    expect(parseArgs(['--apply', '--limit', '25', '--min-length', '12', '--env-file', '.env.test'])).toMatchObject({
      apply: true,
      limit: 25,
      minLength: 12,
      envFile: '.env.test',
    })

    expect(parseArgs([]).apply).toBe(false)
  })

  it('plans only missing reviewable outreach replies for seeding', () => {
    const sourceRows = [
      { id: '11111111-1111-4111-8111-111111111111', reply_content: 'Can we schedule a call?' },
      { id: '22222222-2222-4222-8222-222222222222', reply_content: 'No' },
      { id: '33333333-3333-4333-8333-333333333333', reply_content: 'Tell me more about this.' },
    ]
    const reviewRows = [
      {
        source_table: 'outreach_queue' as const,
        source_id: '11111111-1111-4111-8111-111111111111',
        source_hash: 'source-hash',
        reply_hash: 'reply-hash',
        redacted_reply: 'Can we schedule a call?',
        suggested_labels: {
          scheduling_intent: true,
          interested: true,
          not_interested: false,
          ooo: false,
          needs_followup: false,
        },
        review_status: 'pending' as const,
      },
    ]

    const plan = planReplyIntentReviewSync(sourceRows, reviewRows)

    expect(plan).toMatchObject({
      candidateReplies: 2,
      existingLedgerRows: 1,
      skippedShortReplies: 1,
    })
    expect(plan.pendingToSeed).toEqual([
      expect.objectContaining({ id: '33333333-3333-4333-8333-333333333333' }),
    ])
  })

  it('does not count unrelated ledger rows as existing candidate reviews', () => {
    const sourceRows = [
      { id: '11111111-1111-4111-8111-111111111111', reply_content: 'Can we schedule a call?' },
      { id: '22222222-2222-4222-8222-222222222222', reply_content: 'Tell me more about this.' },
    ]
    const reviewRows = [
      {
        source_table: 'outreach_queue' as const,
        source_id: '99999999-9999-4999-8999-999999999999',
        source_hash: 'unrelated-source-hash',
        reply_hash: 'unrelated-reply-hash',
        redacted_reply: 'Unrelated reply',
        suggested_labels: {
          scheduling_intent: false,
          interested: false,
          not_interested: false,
          ooo: false,
          needs_followup: false,
        },
        review_status: 'reviewed' as const,
        human_scheduling_intent: false,
      },
      {
        source_table: 'outreach_queue' as const,
        source_id: '11111111-1111-4111-8111-111111111111',
        source_hash: 'source-hash',
        reply_hash: 'reply-hash',
        redacted_reply: 'Can we schedule a call?',
        suggested_labels: {
          scheduling_intent: true,
          interested: true,
          not_interested: false,
          ooo: false,
          needs_followup: false,
        },
        review_status: 'reviewed' as const,
        human_scheduling_intent: true,
      },
    ]

    const plan = planReplyIntentReviewSync(sourceRows, reviewRows)

    expect(plan.existingLedgerRows).toBe(1)
    expect(plan.pendingToSeed).toEqual([
      expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222' }),
    ])
  })
})
