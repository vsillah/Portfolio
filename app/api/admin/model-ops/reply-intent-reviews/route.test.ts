import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
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

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mocks.readFile,
    stat: mocks.stat,
  },
  readFile: mocks.readFile,
  stat: mocks.stat,
}))

import { GET, POST } from './route'

const sourceRow = {
  id: '11111111-1111-4111-8111-111111111111',
  channel: 'email',
  sequence_step: 1,
  status: 'replied',
  replied_at: '2026-05-24T10:00:00.000Z',
  created_at: '2026-05-24T09:00:00.000Z',
  reply_content: 'Jane Carter can meet next week at jane@example.com.',
}

function listQuery(result: { data: unknown[]; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  }
}

function sourceSingleQuery(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
}

function upsertQuery(result: { data: unknown; error: unknown }) {
  return {
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
}

function request(url = 'http://localhost/api/admin/model-ops/reply-intent-reviews') {
  return new Request(url, {
    headers: { authorization: 'Bearer token' },
  })
}

describe('reply-intent review API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    const missingFile = Object.assign(new Error('missing export'), { code: 'ENOENT' })
    mocks.readFile.mockRejectedValue(missingFile)
    mocks.stat.mockRejectedValue(missingFile)
  })

  it('requires admin auth before listing reviews', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns virtual pending queue rows from outreach replies', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'outreach_queue') return listQuery({ data: [sourceRow], error: null })
      return listQuery({ data: [], error: null })
    })

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary).toMatchObject({
      total_real_replies: 1,
      reviewed_real: 0,
      pending: 1,
      target: 200,
    })
    expect(body.evidence).toMatchObject({
      exported_real: 0,
      status: 'missing',
      remaining_to_actionable_gate: 200,
    })
    expect(body.source_diagnostics).toMatchObject({
      source_table: 'outreach_queue',
      candidate_replies: 1,
      ledger_rows: 0,
      virtual_pending: 1,
      sync_command: 'npm run model-ops:reply-intent:sync',
    })
    expect(body.items[0].redacted_reply).toContain('[email:')
    expect(body.items[0].redacted_reply).not.toContain('jane@example.com')
  })

  it('marks the exported benchmark artifact as stale when ledger reviews are ahead', async () => {
    const reviewedRow = {
      source_table: 'outreach_queue',
      source_id: sourceRow.id,
      source_hash: 'source-hash',
      reply_hash: 'reply-hash',
      redacted_reply: 'redacted reply',
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
    mocks.readFile.mockResolvedValue('')
    mocks.stat.mockResolvedValue({ mtime: new Date('2026-05-24T11:00:00.000Z') })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'outreach_queue') return listQuery({ data: [sourceRow], error: null })
      return listQuery({ data: [reviewedRow], error: null })
    })

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.reviewed_real).toBe(1)
    expect(body.source_diagnostics).toMatchObject({
      candidate_replies: 1,
      ledger_rows: 1,
      virtual_pending: 0,
      reviewed_real: 1,
    })
    expect(body.evidence).toMatchObject({
      exported_real: 0,
      status: 'stale',
      benchmark_actionable_real: 0,
    })
  })

  it('validates reviewed saves require a boolean scheduling label', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/model-ops/reply-intent-reviews', {
        method: 'POST',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: JSON.stringify({
          source_id: sourceRow.id,
          review_status: 'reviewed',
        }),
      }) as never
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'human_scheduling_intent must be true or false when review_status is reviewed',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('upserts a reviewed label from the source outreach reply', async () => {
    const savedReview = {
      source_table: 'outreach_queue',
      source_id: sourceRow.id,
      source_hash: 'source-hash',
      reply_hash: 'reply-hash',
      redacted_reply: 'redacted reply',
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
    const reviewQuery = upsertQuery({ data: savedReview, error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'outreach_queue') return sourceSingleQuery({ data: sourceRow, error: null })
      return reviewQuery
    })

    const response = await POST(
      new Request('http://localhost/api/admin/model-ops/reply-intent-reviews', {
        method: 'POST',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: JSON.stringify({
          source_id: sourceRow.id,
          review_status: 'reviewed',
          human_scheduling_intent: true,
          notes: 'confirmed',
        }),
      }) as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(reviewQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_id: sourceRow.id,
        review_status: 'reviewed',
        human_scheduling_intent: true,
        notes: 'confirmed',
      }),
      { onConflict: 'source_table,source_id' }
    )
    expect(body.review).toMatchObject({
      source_id: sourceRow.id,
      review_status: 'reviewed',
      human_scheduling_intent: true,
    })
  })
})
