import { describe, expect, it } from 'vitest'
import {
  MODEL_OPS_REPLY_INTENT_SYNC_COMMAND,
  buildPendingReviewSeedPayload,
  buildReplyIntentSourceDiagnostics,
  buildReviewUpsertPayload,
  hasReviewableReplyContent,
  redactReplyText,
  stableHash,
  suggestReplyIntentLabels,
  toReplyIntentQueueItem,
} from './model-ops-reply-intent'

describe('model ops reply-intent helpers', () => {
  it('redacts emails, phones, urls, and likely full names', () => {
    const redacted = redactReplyText(
      'Jane Carter can meet Tuesday. Email jane@example.com or call (404) 555-0101. https://example.com/book'
    )

    expect(redacted).toContain('[name:')
    expect(redacted).toContain('[email:')
    expect(redacted).toContain('[phone:')
    expect(redacted).toContain('[url:example.com:')
    expect(redacted).not.toContain('jane@example.com')
    expect(redacted).not.toContain('(404) 555-0101')
  })

  it('suggests scheduling intent for meeting replies', () => {
    expect(suggestReplyIntentLabels('Can we set up a time for a quick call next week?')).toMatchObject({
      scheduling_intent: true,
      interested: true,
      not_interested: false,
    })
  })

  it('maps a source row and persisted review into a queue item without raw text', () => {
    const item = toReplyIntentQueueItem(
      {
        id: '11111111-1111-4111-8111-111111111111',
        channel: 'email',
        status: 'replied',
        sequence_step: 2,
        replied_at: '2026-05-24T10:00:00.000Z',
        reply_content: 'Let us meet Friday.',
      },
      {
        id: 'review-1',
        source_table: 'outreach_queue',
        source_id: '11111111-1111-4111-8111-111111111111',
        source_hash: 'source-hash',
        reply_hash: 'reply-hash',
        redacted_reply: 'Let us meet Friday.',
        suggested_labels: {
          scheduling_intent: true,
          interested: true,
          not_interested: false,
          ooo: false,
          needs_followup: false,
        },
        review_status: 'reviewed',
        human_scheduling_intent: true,
      }
    )

    expect(item).toMatchObject({
      source_hash: 'source-hash',
      reply_hash: 'reply-hash',
      review_status: 'reviewed',
      human_scheduling_intent: true,
      existing_review_id: 'review-1',
    })
  })

  it('builds reviewed upsert payloads with null labels for unsure rows', () => {
    const payload = buildReviewUpsertPayload({
      source: {
        id: '11111111-1111-4111-8111-111111111111',
        reply_content: 'Not sure yet, follow up later.',
      },
      reviewStatus: 'unsure',
      humanSchedulingIntent: true,
      reviewedBy: 'admin-user',
      reviewedAt: '2026-05-24T12:00:00.000Z',
    })

    expect(payload.human_scheduling_intent).toBeNull()
    expect(payload.reviewed_by).toBe('admin-user')
    expect(payload.source_hash).toBe(stableHash('11111111-1111-4111-8111-111111111111'))
  })

  it('builds pending seed payloads without claiming human review', () => {
    const payload = buildPendingReviewSeedPayload({
      id: '11111111-1111-4111-8111-111111111111',
      channel: 'email',
      status: 'replied',
      sequence_step: 3,
      replied_at: '2026-05-24T10:00:00.000Z',
      reply_content: 'Jane Carter can meet Friday at jane@example.com.',
    })

    expect(payload).toMatchObject({
      source_table: 'outreach_queue',
      source_id: '11111111-1111-4111-8111-111111111111',
      review_status: 'pending',
      human_scheduling_intent: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    expect(payload.redacted_reply).toContain('[email:')
    expect(payload.redacted_reply).not.toContain('jane@example.com')
  })

  it('summarizes source diagnostics and virtual pending rows', () => {
    const sourceRows = [
      { id: 'a', reply_content: 'Can we meet?' },
      { id: 'b', reply_content: 'No thanks.' },
    ]
    const diagnostics = buildReplyIntentSourceDiagnostics({
      sourceRows,
      reviewRows: [
        {
          source_table: 'outreach_queue',
          source_id: 'a',
          source_hash: 'source-hash',
          reply_hash: 'reply-hash',
          redacted_reply: 'Can we meet?',
          suggested_labels: {
            scheduling_intent: true,
            interested: true,
            not_interested: false,
            ooo: false,
            needs_followup: false,
          },
          review_status: 'reviewed',
          human_scheduling_intent: true,
        },
      ],
      reviewStorageAvailable: true,
      sourceLimit: 25,
    })

    expect(diagnostics).toMatchObject({
      candidate_replies: 2,
      ledger_rows: 1,
      virtual_pending: 1,
      reviewed_real: 1,
      source_limit: 25,
      sync_command: MODEL_OPS_REPLY_INTENT_SYNC_COMMAND,
    })
  })

  it('detects reviewable reply text by minimum length', () => {
    expect(hasReviewableReplyContent({ reply_content: 'short' })).toBe(false)
    expect(hasReviewableReplyContent({ reply_content: 'Can we meet next week?' })).toBe(true)
  })
})
