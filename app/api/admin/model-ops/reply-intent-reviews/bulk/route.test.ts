import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

const sourceRows = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    channel: 'email',
    sequence_step: 1,
    status: 'replied',
    replied_at: '2026-05-24T10:00:00.000Z',
    created_at: '2026-05-24T09:00:00.000Z',
    reply_content: 'Can we schedule a quick call?',
  },
]

function sourceListQuery() {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockResolvedValue({ data: sourceRows, error: null }),
  }
}

function upsertQuery() {
  return {
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({
      data: [
        {
          source_table: 'outreach_queue',
          source_id: sourceRows[0].id,
          source_hash: 'source-hash',
          reply_hash: 'reply-hash',
          redacted_reply: 'Can we schedule a quick call?',
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
      error: null,
    }),
  }
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/admin/model-ops/reply-intent-reviews/bulk', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never
  )
}

describe('bulk reply-intent review API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires a supported bulk action', async () => {
    const response = await post({ action: 'delete', source_ids: [sourceRows[0].id] })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unsupported bulk action' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('accepts suggested scheduling labels for selected replies', async () => {
    const reviewQuery = upsertQuery()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'outreach_queue') return sourceListQuery()
      return reviewQuery
    })

    const response = await post({ action: 'accept_suggested', source_ids: [sourceRows[0].id] })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(reviewQuery.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          source_id: sourceRows[0].id,
          review_status: 'reviewed',
          human_scheduling_intent: true,
        }),
      ],
      { onConflict: 'source_table,source_id' }
    )
    expect(body.updated).toBe(1)
    expect(body.reviews[0]).toMatchObject({
      source_id: sourceRows[0].id,
      review_status: 'reviewed',
      human_scheduling_intent: true,
    })
  })
})
