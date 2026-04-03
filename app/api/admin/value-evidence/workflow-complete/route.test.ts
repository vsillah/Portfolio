import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockState, calls, supabaseAdminMock } = vi.hoisted(() => {
  const mockState = {
    runById: null as { id: string } | null,
    runningRun: null as { id: string } | null,
    createdRun: { id: 'created-run-id' } as { id: string } | null,
    updateError: null as { message: string } | null,
  }

  const calls = {
    inserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
    updates: [] as Array<{ table: string; payload: Record<string, unknown> }>,
    updateEq: [] as Array<{ field: string; value: string }>,
    selectFilters: [] as Array<Array<{ field: string; value: unknown }>>,
  }

  const supabaseAdminMock = {
    from: vi.fn((table: string) => {
      return {
        select: vi.fn((_columns: string) => {
          const filters: Array<{ field: string; value: unknown }> = []
          const query = {
            eq(field: string, value: unknown) {
              filters.push({ field, value })
              return query
            },
            order() {
              return query
            },
            limit() {
              return query
            },
            async single() {
              calls.selectFilters.push([...filters])
              const lookedUpById = filters.some((filter) => filter.field === 'id')
              return { data: lookedUpById ? mockState.runById : null }
            },
            async maybeSingle() {
              calls.selectFilters.push([...filters])
              return { data: mockState.runningRun }
            },
          }
          return query
        }),
        insert: vi.fn((payload: Record<string, unknown>) => {
          calls.inserts.push({ table, payload })
          return {
            select: vi.fn((_columns: string) => ({
              async single() {
                return { data: mockState.createdRun }
              },
            })),
          }
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          calls.updates.push({ table, payload })
          return {
            async eq(field: string, value: string) {
              calls.updateEq.push({ field, value })
              return { error: mockState.updateError }
            },
          }
        }),
      }
    }),
  }

  return { mockState, calls, supabaseAdminMock }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>, token: string | null = 'test-secret') {
  const headers: HeadersInit = {
    'content-type': 'application/json',
  }
  if (token) {
    headers.authorization = `Bearer ${token}`
  }

  return new Request('http://localhost/api/admin/value-evidence/workflow-complete', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/workflow-complete', () => {
  beforeEach(() => {
    process.env.N8N_INGEST_SECRET = 'test-secret'
    mockState.runById = null
    mockState.runningRun = null
    mockState.createdRun = { id: 'created-run-id' }
    mockState.updateError = null

    calls.inserts.length = 0
    calls.updates.length = 0
    calls.updateEq.length = 0
    calls.selectFilters.length = 0
    vi.clearAllMocks()
  })

  it('returns 401 when the bearer token is missing or invalid', async () => {
    const response = await POST(makeRequest({ workflow_id: 'vep001' }, null) as never)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(supabaseAdminMock.from).not.toHaveBeenCalled()
  })

  it('returns 400 when workflow_id is missing or unsupported', async () => {
    const missingWorkflowResponse = await POST(makeRequest({ status: 'success' }) as never)
    expect(missingWorkflowResponse.status).toBe(400)
    expect(await missingWorkflowResponse.json()).toEqual({ error: 'workflow_id is required' })

    const unsupportedWorkflowResponse = await POST(
      makeRequest({ workflow_id: 'vep999', status: 'success' }) as never
    )
    expect(unsupportedWorkflowResponse.status).toBe(400)
    expect(await unsupportedWorkflowResponse.json()).toEqual({
      error: 'workflow_id must be vep001, vep002, WF-VEP-001, or WF-VEP-002',
    })
  })

  it('normalizes WF-VEP-001 and updates a run resolved by run_id', async () => {
    mockState.runById = { id: 'run-123' }

    const response = await POST(
      makeRequest({
        run_id: 'run-123',
        workflow_id: 'WF-VEP-001',
        status: 'success',
      }) as never
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, run_id: 'run-123' })
    expect(calls.selectFilters).toHaveLength(1)
    expect(calls.selectFilters[0]).toContainEqual({ field: 'id', value: 'run-123' })
    expect(calls.inserts).toHaveLength(0)
    expect(calls.updateEq).toEqual([{ field: 'id', value: 'run-123' }])
    expect(calls.updates[0].payload).toMatchObject({
      status: 'success',
      completed_at: expect.any(String),
      updated_at: expect.any(String),
    })
  })

  it('creates a run when none exists and marks it failed with completion details', async () => {
    mockState.runById = null
    mockState.runningRun = null
    mockState.createdRun = { id: 'created-99' }

    const response = await POST(
      makeRequest({
        workflow_id: 'WF-VEP-002',
        status: 'failed',
        items_inserted: 0,
        error_message: 'n8n failure',
      }) as never
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, run_id: 'created-99' })

    expect(calls.inserts).toEqual([
      {
        table: 'value_evidence_workflow_runs',
        payload: { workflow_id: 'vep002', status: 'running' },
      },
    ])
    expect(calls.updateEq).toEqual([{ field: 'id', value: 'created-99' }])
    expect(calls.updates[0].payload).toMatchObject({
      status: 'failed',
      completed_at: expect.any(String),
      updated_at: expect.any(String),
      items_inserted: 0,
      error_message: 'n8n failure',
    })
  })
})
