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
  return new Request('http://localhost/api/admin/value-evidence/workflow-complete', {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/workflow-complete', () => {
  beforeEach(() => {
    process.env.N8N_INGEST_SECRET = 'test-ingest-secret'
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('creates a workflow-scoped run when no running row exists', async () => {
    const db = createSupabaseAdminMock({
      maybeSingle: [{ data: null, error: null }],
      single: [{ data: { id: 'vep-created-1' }, error: null }],
      updateEq: [{ error: null }],
    })
    vi.doMock('@/lib/supabase', () => ({ supabaseAdmin: db.supabaseAdmin }))

    const { POST } = await import('@/app/api/admin/value-evidence/workflow-complete/route')
    const response = await POST(
      makeRequest({
        workflow_id: 'WF-VEP-002',
        status: 'success',
        items_inserted: 12,
      }) as never
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true, run_id: 'vep-created-1' })
    expect(db.calls.inserts).toEqual([
      {
        table: 'value_evidence_workflow_runs',
        values: { workflow_id: 'vep002', status: 'running' },
      },
    ])
    expect(db.calls.updates[0].values).toMatchObject({
      status: 'success',
      items_inserted: 12,
    })
    expect(typeof db.calls.updates[0].values.completed_at).toBe('string')
    expect(typeof db.calls.updates[0].values.updated_at).toBe('string')
  })

  it('uses provided run_id and does not create a fallback row', async () => {
    const db = createSupabaseAdminMock({
      single: [{ data: { id: 'existing-run-42' }, error: null }],
      updateEq: [{ error: null }],
    })
    vi.doMock('@/lib/supabase', () => ({ supabaseAdmin: db.supabaseAdmin }))

    const { POST } = await import('@/app/api/admin/value-evidence/workflow-complete/route')
    const response = await POST(
      makeRequest({
        run_id: 'existing-run-42',
        workflow_id: 'vep001',
        status: 'failed',
        error_message: 'classifier failed',
      }) as never
    )

    expect(response.status).toBe(200)
    expect(db.calls.inserts).toHaveLength(0)
    expect(db.calls.updates[0].values).toMatchObject({
      status: 'failed',
      error_message: 'classifier failed',
    })
    expect(
      db.calls.eq.some(
        (entry) =>
          entry.table === 'value_evidence_workflow_runs' &&
          entry.mode === 'select' &&
          entry.column === 'id' &&
          entry.value === 'existing-run-42'
      )
    ).toBe(true)
  })

  it('returns 400 when workflow_id is missing', async () => {
    const db = createSupabaseAdminMock()
    vi.doMock('@/lib/supabase', () => ({ supabaseAdmin: db.supabaseAdmin }))

    const { POST } = await import('@/app/api/admin/value-evidence/workflow-complete/route')
    const response = await POST(makeRequest({ status: 'success' }) as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'workflow_id is required' })
    expect(db.supabaseAdmin.from).not.toHaveBeenCalled()
  })
})
