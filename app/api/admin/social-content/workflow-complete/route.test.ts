import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: fromMock },
}))

import { POST } from './route'

type DbResult = { data?: unknown; error?: { message: string } | null }

function createSelectBuilder({
  singleResult,
  maybeSingleResult,
}: {
  singleResult?: DbResult
  maybeSingleResult?: DbResult
}) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.single = vi.fn().mockResolvedValue(singleResult ?? { data: null, error: null })
  builder.maybeSingle = vi.fn().mockResolvedValue(maybeSingleResult ?? { data: null, error: null })
  return builder
}

function createInsertBuilder(singleResult: DbResult) {
  const single = vi.fn().mockResolvedValue(singleResult)
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  return { insert, single }
}

function createUpdateBuilder(eqResult: DbResult) {
  const eq = vi.fn().mockResolvedValue(eqResult)
  const update = vi.fn((_payload: Record<string, unknown>) => ({ eq }))
  return { update, eq }
}

function makeRequest(body: unknown, token: string) {
  return new Request('http://localhost/api/admin/social-content/workflow-complete', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/social-content/workflow-complete', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv, N8N_INGEST_SECRET: 'test-secret' }
    fromMock.mockReset()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  it('returns 401 when bearer token is invalid', async () => {
    const response = await POST(makeRequest({ status: 'success' }, 'wrong-token') as any)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('creates a run for cron-style completions and marks it failed', async () => {
    const runningLookup = createSelectBuilder({
      maybeSingleResult: { data: null, error: null },
    })
    const insertBuilder = createInsertBuilder({
      data: { id: 'soc-run-1' },
      error: null,
    })
    const updateBuilder = createUpdateBuilder({ data: null, error: null })

    const queue = [runningLookup, insertBuilder, updateBuilder]
    fromMock.mockImplementation(() => {
      const next = queue.shift()
      if (!next) throw new Error('Unexpected supabaseAdmin.from() call')
      return next
    })

    const response = await POST(
      makeRequest(
        {
          status: 'failed',
          items_inserted: 0,
          error_message: 'workflow timeout',
        },
        'test-secret'
      ) as any
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, run_id: 'soc-run-1', agent_run_id: null })
    expect(insertBuilder.insert).toHaveBeenCalledWith({ status: 'running' })

    const updatePayload = updateBuilder.update.mock.calls[0][0] as Record<string, unknown>
    expect(updatePayload.status).toBe('failed')
    expect(updatePayload.error_message).toBe('workflow timeout')
    expect(updatePayload.items_inserted).toBe(0)
    expect(typeof updatePayload.completed_at).toBe('string')
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'soc-run-1')
  })

  it('uses matching run_id when provided and defaults non-failed status to success', async () => {
    const byIdLookup = createSelectBuilder({
      singleResult: { data: { id: 'run-7' }, error: null },
    })
    const updateBuilder = createUpdateBuilder({ data: null, error: null })

    const queue = [byIdLookup, updateBuilder]
    fromMock.mockImplementation(() => {
      const next = queue.shift()
      if (!next) throw new Error('Unexpected supabaseAdmin.from() call')
      return next
    })

    const response = await POST(
      makeRequest(
        {
          run_id: 'run-7',
          status: 'anything-else',
          items_inserted: 4,
        },
        'test-secret'
      ) as any
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, run_id: 'run-7', agent_run_id: null })

    const updatePayload = updateBuilder.update.mock.calls[0][0] as Record<string, unknown>
    expect(updatePayload.status).toBe('success')
    expect(updatePayload.items_inserted).toBe(4)
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'run-7')
  })
})
