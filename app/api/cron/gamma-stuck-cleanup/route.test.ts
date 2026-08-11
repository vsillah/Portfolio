import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  supabaseAdmin: null as { from: ReturnType<typeof vi.fn> } | null,
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabaseAdmin
  },
}))

import { POST } from './route'

function request(token?: string) {
  return new Request('http://localhost/api/cron/gamma-stuck-cleanup', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

function stuckSelectQuery(result: { data: Array<{ id: string }> | null; error: unknown }) {
  const query: Record<string, unknown> = {
    eq: vi.fn(() => query),
    lt: vi.fn(() => Promise.resolve(result)),
  }
  return {
    select: vi.fn(() => query),
  }
}

function failedUpdateQuery(result: { error: unknown }) {
  return {
    update: vi.fn(() => ({
      in: vi.fn(() => Promise.resolve(result)),
    })),
  }
}

describe('POST /api/cron/gamma-stuck-cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T10:00:00.000Z'))
    process.env.N8N_INGEST_SECRET = 'n8n-secret'
    mocks.supabaseAdmin = { from: mocks.from }
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.N8N_INGEST_SECRET
  })

  it('rejects requests without a valid N8N_INGEST_SECRET bearer token', async () => {
    const response = await POST(request('wrong') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects when the ingest secret is unset', async () => {
    delete process.env.N8N_INGEST_SECRET

    const response = await POST(request('n8n-secret') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns a server error when the admin Supabase client is unavailable', async () => {
    mocks.supabaseAdmin = null

    const response = await POST(request('n8n-secret') as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Server misconfigured' })
  })

  it('returns zero updates when no generating reports are older than the threshold', async () => {
    mocks.from.mockReturnValue(stuckSelectQuery({ data: [], error: null }))

    const response = await POST(request('n8n-secret') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      updated: 0,
      ids: [],
      message: 'No stuck rows',
    })
    expect(mocks.from).toHaveBeenCalledWith('gamma_reports')
  })

  it('marks stuck generating reports as failed with the cleanup message', async () => {
    const update = vi.fn(() => ({
      in: vi.fn(() => Promise.resolve({ error: null })),
    }))

    mocks.from
      .mockReturnValueOnce(stuckSelectQuery({
        data: [{ id: 'gamma-1' }, { id: 'gamma-2' }],
        error: null,
      }))
      .mockReturnValueOnce({ update })

    const response = await POST(request('n8n-secret') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      updated: 2,
      ids: ['gamma-1', 'gamma-2'],
      message: 'Marked 2 row(s) as failed',
    })
    expect(update).toHaveBeenCalledWith({
      status: 'failed',
      error_message: 'Stuck in generating — cleaned up by scheduled job',
      updated_at: '2026-08-11T10:00:00.000Z',
    })
  })

  it('returns a database error when the stuck select fails', async () => {
    mocks.from.mockReturnValue(
      stuckSelectQuery({ data: null, error: { message: 'relation missing' } })
    )

    const response = await POST(request('n8n-secret') as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Database error' })
  })

  it('returns an update failure when marking stuck rows fails', async () => {
    mocks.from
      .mockReturnValueOnce(stuckSelectQuery({
        data: [{ id: 'gamma-1' }],
        error: null,
      }))
      .mockReturnValueOnce(failedUpdateQuery({ error: { message: 'update failed' } }))

    const response = await POST(request('n8n-secret') as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Update failed' })
  })
})
