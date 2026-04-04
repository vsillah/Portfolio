import { beforeEach, describe, expect, it, vi } from 'vitest'

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: vi.fn(),
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

import { POST } from './route'

type QueryResult = {
  data?: unknown
  error?: { message: string } | null
}

function createBuilder(
  tracker: {
    insertPayloads: unknown[]
    updatePayloads: unknown[]
    eqCalls: Array<{ column: string; value: unknown }>
  },
  config: {
    singleResult?: QueryResult
    maybeSingleResult?: QueryResult
    updateResult?: { error: { message: string } | null }
  } = {}
) {
  let pendingUpdate = false

  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      tracker.insertPayloads.push(payload)
      return builder
    }),
    update: vi.fn((payload: unknown) => {
      tracker.updatePayloads.push(payload)
      pendingUpdate = true
      return builder
    }),
    eq: vi.fn((column: string, value: unknown) => {
      tracker.eqCalls.push({ column, value })
      if (pendingUpdate) {
        pendingUpdate = false
        return Promise.resolve(config.updateResult ?? { error: null })
      }
      return builder
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(async () => config.singleResult ?? { data: null, error: null }),
    maybeSingle: vi.fn(async () => config.maybeSingleResult ?? { data: null, error: null }),
  }

  return builder
}

function makeRequest(body: unknown, token?: string) {
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
    vi.clearAllMocks()
    process.env.N8N_INGEST_SECRET = 'test-secret'
  })

  it('returns 401 when bearer token is invalid', async () => {
    const response = await POST(makeRequest({ workflow_id: 'vep001' }, 'wrong-secret') as never)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(supabaseAdminMock.from).not.toHaveBeenCalled()
  })

  it('returns 400 when workflow_id is missing', async () => {
    const response = await POST(makeRequest({}, 'test-secret') as never)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'workflow_id is required' })
    expect(supabaseAdminMock.from).not.toHaveBeenCalled()
  })

  it('returns 400 when workflow_id is invalid', async () => {
    const response = await POST(
      makeRequest({ workflow_id: 'vep999', status: 'success' }, 'test-secret') as never
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('workflow_id must be vep001')
    expect(supabaseAdminMock.from).not.toHaveBeenCalled()
  })

  it('normalizes WF-VEP-001, creates a missing run, and marks it failed', async () => {
    const tracker = {
      insertPayloads: [] as unknown[],
      updatePayloads: [] as unknown[],
      eqCalls: [] as Array<{ column: string; value: unknown }>,
    }

    const findByRunIdBuilder = createBuilder(tracker, {
      singleResult: { data: null, error: null },
    })
    const findRunningBuilder = createBuilder(tracker, {
      maybeSingleResult: { data: null, error: null },
    })
    const createRunBuilder = createBuilder(tracker, {
      singleResult: { data: { id: 'created-run-id' }, error: null },
    })
    const updateBuilder = createBuilder(tracker, {
      updateResult: { error: null },
    })

    const builders = [findByRunIdBuilder, findRunningBuilder, createRunBuilder, updateBuilder]
    supabaseAdminMock.from.mockImplementation(() => builders.shift())

    const response = await POST(
      makeRequest(
        {
          run_id: 'missing-run',
          workflow_id: 'WF-VEP-001',
          status: 'failed',
          items_inserted: 4,
          error_message: 'n8n failed',
        },
        'test-secret'
      ) as never
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ ok: true, run_id: 'created-run-id' })
    expect(tracker.insertPayloads).toEqual([{ workflow_id: 'vep001', status: 'running' }])

    expect(tracker.updatePayloads).toHaveLength(1)
    expect(tracker.updatePayloads[0]).toMatchObject({
      status: 'failed',
      items_inserted: 4,
      error_message: 'n8n failed',
    })
    expect((tracker.updatePayloads[0] as Record<string, unknown>).completed_at).toEqual(
      expect.any(String)
    )
    expect((tracker.updatePayloads[0] as Record<string, unknown>).updated_at).toEqual(
      expect.any(String)
    )
  })

  it('updates an existing run_id directly and defaults unknown completion status to success', async () => {
    const tracker = {
      insertPayloads: [] as unknown[],
      updatePayloads: [] as unknown[],
      eqCalls: [] as Array<{ column: string; value: unknown }>,
    }

    const findByRunIdBuilder = createBuilder(tracker, {
      singleResult: { data: { id: 'existing-run-id' }, error: null },
    })
    const updateBuilder = createBuilder(tracker, {
      updateResult: { error: null },
    })

    const builders = [findByRunIdBuilder, updateBuilder]
    supabaseAdminMock.from.mockImplementation(() => builders.shift())

    const response = await POST(
      makeRequest(
        {
          run_id: 'existing-run-id',
          workflow_id: 'vep002',
          status: 'unexpected-value',
        },
        'test-secret'
      ) as never
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ ok: true, run_id: 'existing-run-id' })
    expect(tracker.insertPayloads).toEqual([])
    expect(tracker.updatePayloads[0]).toMatchObject({ status: 'success' })
  })
})
