import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type DbResult = { data?: unknown; error?: unknown }

function createSupabaseAdminMock({
  single = [],
  maybeSingle = [],
  updateEq = [],
}: {
  single?: DbResult[]
  maybeSingle?: DbResult[]
  updateEq?: DbResult[]
} = {}) {
  const calls = {
    inserts: [] as Array<{ table: string; values: unknown }>,
    updates: [] as Array<{ table: string; values: Record<string, unknown> }>,
    eq: [] as Array<{ table: string; mode: 'select' | 'insert' | 'update'; column: string; value: unknown }>,
  }

  const next = (queue: DbResult[]) => queue.shift() ?? { data: null, error: null }

  const supabaseAdmin = {
    from: vi.fn((table: string) => {
      const state: { mode: 'select' | 'insert' | 'update' } = { mode: 'select' }
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          calls.eq.push({ table, mode: state.mode, column, value })
          if (state.mode === 'update') {
            return Promise.resolve(next(updateEq))
          }
          return builder
        }),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve(next(maybeSingle))),
        single: vi.fn(() => Promise.resolve(next(single))),
        insert: vi.fn((values: unknown) => {
          state.mode = 'insert'
          calls.inserts.push({ table, values })
          return builder
        }),
        update: vi.fn((values: Record<string, unknown>) => {
          state.mode = 'update'
          calls.updates.push({ table, values })
          return builder
        }),
      }

      return builder
    }),
  }

  return { supabaseAdmin, calls }
}

const originalEnv = { ...process.env }

function makeRequest(
  body: Record<string, unknown>,
  authorization = 'Bearer test-ingest-secret'
) {
  return new Request('http://localhost/api/admin/social-content/workflow-complete', {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/social-content/workflow-complete', () => {
  beforeEach(() => {
    process.env.N8N_INGEST_SECRET = 'test-ingest-secret'
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('creates a new run record when no running row exists', async () => {
    const db = createSupabaseAdminMock({
      maybeSingle: [{ data: null, error: null }],
      single: [{ data: { id: 'run-created-1' }, error: null }],
      updateEq: [{ error: null }],
    })
    vi.doMock('@/lib/supabase', () => ({ supabaseAdmin: db.supabaseAdmin }))

    const { POST } = await import('@/app/api/admin/social-content/workflow-complete/route')
    const response = await POST(
      makeRequest({ status: 'success', items_inserted: 4 }) as never
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true, run_id: 'run-created-1' })
    expect(db.calls.inserts).toEqual([
      { table: 'social_content_extraction_runs', values: { status: 'running' } },
    ])
    expect(db.calls.updates[0].values).toMatchObject({
      status: 'success',
      items_inserted: 4,
    })
    expect(typeof db.calls.updates[0].values.completed_at).toBe('string')
  })

  it('normalizes failed completion and stores error message', async () => {
    const db = createSupabaseAdminMock({
      maybeSingle: [{ data: { id: 'run-running-1' }, error: null }],
      updateEq: [{ error: null }],
    })
    vi.doMock('@/lib/supabase', () => ({ supabaseAdmin: db.supabaseAdmin }))

    const { POST } = await import('@/app/api/admin/social-content/workflow-complete/route')
    const response = await POST(
      makeRequest({ status: 'failed', error_message: 'n8n timeout' }) as never
    )

    expect(response.status).toBe(200)
    expect(db.calls.inserts).toHaveLength(0)
    expect(db.calls.updates[0].values).toMatchObject({
      status: 'failed',
      error_message: 'n8n timeout',
    })
  })

  it('rejects invalid ingest token', async () => {
    const db = createSupabaseAdminMock()
    vi.doMock('@/lib/supabase', () => ({ supabaseAdmin: db.supabaseAdmin }))

    const { POST } = await import('@/app/api/admin/social-content/workflow-complete/route')
    const response = await POST(
      makeRequest({ status: 'success' }, 'Bearer wrong-secret') as never
    )
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Unauthorized' })
    expect(db.supabaseAdmin.from).not.toHaveBeenCalled()
  })
})
