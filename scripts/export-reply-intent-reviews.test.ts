import { describe, expect, it } from 'vitest'
import { parseArgs, toJsonlExample } from './export-reply-intent-reviews'

describe('export reply-intent reviews script', () => {
  it('parses export options', () => {
    expect(parseArgs(['--output', '/tmp/replies.jsonl', '--limit', '25', '--env-file', '.env.test'])).toMatchObject({
      output: '/tmp/replies.jsonl',
      limit: 25,
      envFile: '.env.test',
    })
  })

  it('exports reviewed rows in sanitized benchmark JSONL shape', () => {
    const example = toJsonlExample({
      source_table: 'outreach_queue',
      source_id: '11111111-1111-4111-8111-111111111111',
      source_hash: 'source-hash',
      reply_hash: 'reply-hash',
      channel: 'email',
      sequence_step: 1,
      redacted_reply: 'Can we schedule next week?',
      suggested_labels: {
        scheduling_intent: true,
        interested: true,
        not_interested: false,
        ooo: false,
        needs_followup: false,
      },
      review_status: 'reviewed',
      human_scheduling_intent: true,
      notes: 'confirmed',
      reviewed_at: '2026-05-24T12:00:00.000Z',
    })

    expect(example).toMatchObject({
      source: 'portfolio_model_ops_reply_intent_reviews',
      source_ref: {
        table: 'outreach_queue',
        row_hash: 'source-hash',
        reply_hash: 'reply-hash',
      },
      text_redacted: 'Can we schedule next week?',
      review: {
        scheduling_intent: true,
        notes: 'confirmed',
      },
    })
    expect(JSON.stringify(example)).not.toContain('11111111-1111-4111-8111-111111111111')
  })
})
