/**
 * lead-correspondence-context — Phase 3 prior outreach loader
 *
 * Covers:
 *  - empty state (no rows) returns null block + zero metadata
 *  - outreach_queue rows render newest-first (timestamp ordering)
 *  - reply_content on outreach_queue is rendered as inbound + flips has_inbound
 *  - inbound contact_communications rows that mirror outreach_queue (same
 *    source_id) are NOT double-rendered
 *  - inbound contact_communications rows without a matching outreach_queue
 *    row ARE rendered (cold inbound / manual logs)
 *  - global PRIOR_OUTREACH_TOTAL_CHAR_CAP truncates with "[earlier history truncated]"
 *  - PRIOR_OUTREACH_MAX_ENTRIES caps the number of entries
 *  - per-row body cap truncates long bodies with "…"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface OqRow {
  id: string
  channel: string
  subject: string | null
  body: string
  sequence_step: number | null
  status: string
  reply_content: string | null
  sent_at: string | null
  replied_at: string | null
  created_at: string
}

interface CcRow {
  id: string
  channel: string
  direction: 'outbound' | 'inbound'
  message_type: string
  subject: string | null
  body: string
  source_system: string
  source_id: string | null
  status: string
  sent_at: string | null
  created_at: string
}

let mockOqRows: OqRow[] = []
let mockCcRows: CcRow[] = []

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'outreach_queue') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({ data: mockOqRows, error: null }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'contact_communications') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({ data: mockCcRows, error: null }),
                }),
              }),
            }),
          }),
        }
      }
      return {}
    }),
  },
}))

const NOW = new Date('2026-04-27T15:00:00Z').getTime()

function iso(daysAgo: number): string {
  return new Date(NOW - daysAgo * 86_400_000).toISOString()
}

describe('loadLeadCorrespondenceExcerpt', () => {
  beforeEach(() => {
    vi.resetModules()
    mockOqRows = []
    mockCcRows = []
  })

  it('returns null + zero metadata when there is no history', async () => {
    const { loadLeadCorrespondenceExcerpt } = await import(
      '../lead-correspondence-context'
    )
    const { block, metadata } = await loadLeadCorrespondenceExcerpt(99, 'email')
    expect(block).toBeNull()
    expect(metadata.entriesIncluded).toBe(0)
    expect(metadata.entriesConsidered).toBe(0)
    expect(metadata.chars).toBe(0)
    expect(metadata.hasInbound).toBe(false)
  })

  it('returns null + zero metadata for invalid contact ids', async () => {
    const { loadLeadCorrespondenceExcerpt } = await import(
      '../lead-correspondence-context'
    )
    const r1 = await loadLeadCorrespondenceExcerpt(0, 'email')
    expect(r1.block).toBeNull()
    const r2 = await loadLeadCorrespondenceExcerpt(-5, 'email')
    expect(r2.block).toBeNull()
  })

  it('renders outreach_queue rows oldest-first within the block', async () => {
    mockOqRows = [
      // Newest first as Supabase returns
      {
        id: 'oq-2',
        channel: 'email',
        subject: 'Step 2 follow-up',
        body: 'Bumping this — happy to share that case study.',
        sequence_step: 2,
        status: 'sent',
        reply_content: null,
        sent_at: iso(1),
        replied_at: null,
        created_at: iso(1),
      },
      {
        id: 'oq-1',
        channel: 'email',
        subject: 'Initial pitch',
        body: 'Saw your AI rollout — would love to compare notes.',
        sequence_step: 1,
        status: 'sent',
        reply_content: null,
        sent_at: iso(7),
        replied_at: null,
        created_at: iso(7),
      },
    ]
    const { loadLeadCorrespondenceExcerpt } = await import(
      '../lead-correspondence-context'
    )
    const { block, metadata } = await loadLeadCorrespondenceExcerpt(99, 'email')
    expect(block).not.toBeNull()
    expect(metadata.entriesIncluded).toBe(2)
    // Oldest entry (step 1) renders before the newer entry (step 2).
    const step1Idx = block!.indexOf('Initial pitch')
    const step2Idx = block!.indexOf('Step 2 follow-up')
    expect(step1Idx).toBeGreaterThan(-1)
    expect(step2Idx).toBeGreaterThan(step1Idx)
    expect(block).toContain('Prior outreach history')
  })

  it('renders reply_content as an inbound block + flips hasInbound', async () => {
    mockOqRows = [
      {
        id: 'oq-1',
        channel: 'email',
        subject: 'Initial pitch',
        body: 'Saw your AI rollout — happy to share notes.',
        sequence_step: 1,
        status: 'replied',
        reply_content: 'Thanks — let’s pick this up next week. — Kyle',
        sent_at: iso(5),
        replied_at: iso(3),
        created_at: iso(5),
      },
    ]
    const { loadLeadCorrespondenceExcerpt } = await import(
      '../lead-correspondence-context'
    )
    const { block, metadata } = await loadLeadCorrespondenceExcerpt(99, 'email')
    expect(metadata.hasInbound).toBe(true)
    expect(block).toContain('reply received')
    expect(block).toContain('Kyle')
  })

  it('does not double-render inbound comms that mirror outreach_queue', async () => {
    mockOqRows = [
      {
        id: 'oq-1',
        channel: 'email',
        subject: 'Initial pitch',
        body: 'Saw your AI rollout.',
        sequence_step: 1,
        status: 'replied',
        reply_content: 'Reply via outreach_queue.reply_content',
        sent_at: iso(5),
        replied_at: iso(3),
        created_at: iso(5),
      },
    ]
    mockCcRows = [
      {
        id: 'cc-mirror',
        channel: 'email',
        direction: 'inbound',
        message_type: 'reply',
        subject: 'Re: Initial pitch',
        body: 'Reply via contact_communications mirror — should be skipped',
        source_system: 'outreach_queue',
        source_id: 'oq-1',
        status: 'replied',
        sent_at: iso(3),
        created_at: iso(3),
      },
    ]
    const { loadLeadCorrespondenceExcerpt } = await import(
      '../lead-correspondence-context'
    )
    const { block, metadata } = await loadLeadCorrespondenceExcerpt(99, 'email')
    expect(metadata.entriesIncluded).toBe(1)
    expect(block).toContain('Reply via outreach_queue.reply_content')
    expect(block).not.toContain('contact_communications mirror')
  })

  it('renders inbound comms that have no matching outreach_queue row', async () => {
    mockOqRows = []
    mockCcRows = [
      {
        id: 'cc-cold',
        channel: 'email',
        direction: 'inbound',
        message_type: 'reply',
        subject: 'Cold inbound',
        body: 'Hey — found your post and wanted to chat.',
        source_system: 'manual',
        source_id: null,
        status: 'replied',
        sent_at: iso(2),
        created_at: iso(2),
      },
    ]
    const { loadLeadCorrespondenceExcerpt } = await import(
      '../lead-correspondence-context'
    )
    const { block, metadata } = await loadLeadCorrespondenceExcerpt(99, 'email')
    expect(metadata.entriesIncluded).toBe(1)
    expect(metadata.hasInbound).toBe(true)
    expect(block).toContain('Hey — found your post')
  })

  it('respects PRIOR_OUTREACH_MAX_ENTRIES', async () => {
    const { PRIOR_OUTREACH_MAX_ENTRIES } = await import(
      '../lead-correspondence-context'
    )
    mockOqRows = Array.from({ length: PRIOR_OUTREACH_MAX_ENTRIES + 3 }, (_, i) => ({
      id: `oq-${i}`,
      channel: 'email',
      subject: `Subject ${i}`,
      body: `Body ${i}`,
      sequence_step: 1,
      status: 'sent',
      reply_content: null,
      sent_at: iso(i + 1),
      replied_at: null,
      created_at: iso(i + 1),
    }))
    const { loadLeadCorrespondenceExcerpt } = await import(
      '../lead-correspondence-context'
    )
    const { metadata } = await loadLeadCorrespondenceExcerpt(99, 'email')
    expect(metadata.entriesConsidered).toBe(PRIOR_OUTREACH_MAX_ENTRIES + 3)
    expect(metadata.entriesIncluded).toBe(PRIOR_OUTREACH_MAX_ENTRIES)
  })

  it('truncates with [earlier history truncated] when block exceeds the global cap', async () => {
    const { PRIOR_OUTREACH_TOTAL_CHAR_CAP, PRIOR_OUTREACH_MAX_ENTRIES } =
      await import('../lead-correspondence-context')
    // Each row's body is capped at PER_ROW_BODY_CHAR_CAP (700) chars before
    // injection, so we need MAX_ENTRIES rows with maxed-out bodies for the
    // global cap to trigger truncation.
    const longBody = 'X'.repeat(2000)
    mockOqRows = Array.from({ length: PRIOR_OUTREACH_MAX_ENTRIES }, (_, i) => ({
      id: `oq-${i}`,
      channel: 'email',
      subject: `Subject ${i}`,
      body: longBody,
      sequence_step: 1,
      status: 'sent',
      reply_content: null,
      sent_at: iso(i + 1),
      replied_at: null,
      created_at: iso(i + 1),
    }))
    const { loadLeadCorrespondenceExcerpt } = await import(
      '../lead-correspondence-context'
    )
    const { block, metadata } = await loadLeadCorrespondenceExcerpt(99, 'email')
    expect(block).toContain('[earlier history truncated]')
    expect(block!.length).toBeLessThanOrEqual(PRIOR_OUTREACH_TOTAL_CHAR_CAP + 200)
    expect(metadata.entriesIncluded).toBeLessThan(metadata.entriesConsidered)
  })

  it('caps each row body and signals truncation with an ellipsis', async () => {
    const longBody = 'A'.repeat(2000)
    mockOqRows = [
      {
        id: 'oq-1',
        channel: 'email',
        subject: 'Subject',
        body: longBody,
        sequence_step: 1,
        status: 'sent',
        reply_content: null,
        sent_at: iso(2),
        replied_at: null,
        created_at: iso(2),
      },
    ]
    const { loadLeadCorrespondenceExcerpt } = await import(
      '../lead-correspondence-context'
    )
    const { block } = await loadLeadCorrespondenceExcerpt(99, 'email')
    expect(block).toContain('…')
    // The full 2000-char body must not be present verbatim.
    expect(block).not.toContain(longBody)
  })
})
