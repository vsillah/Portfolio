import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET, PATCH } from './route'

function getRequest() {
  return new NextRequest('http://localhost/api/admin/agents/runs/run-1')
}

function patchRequest(body: unknown, authHeader = 'Bearer admin-token') {
  return new NextRequest('http://localhost/api/admin/agents/runs/run-1', {
    method: 'PATCH',
    headers: {
      authorization: authHeader,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const params = { params: { runId: 'run-1' } }

function emptyRelatedQuery() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
}

describe('GET /api/admin/agents/runs/:runId', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires admin auth even when an ingest secret is present', async () => {
    vi.stubEnv('N8N_INGEST_SECRET', 'n8n-secret')
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(
      new NextRequest('http://localhost/api/admin/agents/runs/run-1', {
        headers: { authorization: 'Bearer n8n-secret' },
      }),
      params,
    )

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the run is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'agent_runs') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }
      }
      return emptyRelatedQuery()
    })

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Run not found' })
  })

  it('sums related cost rows onto cost_total', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'agent_runs') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'run-1', status: 'completed' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'cost_events') {
        return {
          select: () => ({
            eq: () => ({
              order: vi.fn().mockResolvedValue({
                data: [{ amount: 1.2 }, { amount: '0.3' }, { amount: null }],
                error: null,
              }),
            }),
          }),
        }
      }
      return emptyRelatedQuery()
    })

    const response = await GET(getRequest(), params)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.run).toEqual({ id: 'run-1', status: 'completed' })
    expect(body.cost_total).toBe(1.5)
    expect(body.steps).toEqual([])
    expect(body.approvals).toEqual([])
  })
})

describe('PATCH /api/admin/agents/runs/:runId', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires admin auth when the ingest secret does not match', async () => {
    vi.stubEnv('N8N_INGEST_SECRET', 'n8n-secret')
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await PATCH(patchRequest({ status: 'cancelled' }, 'Bearer wrong'), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an invalid status without writing', async () => {
    const response = await PATCH(patchRequest({ status: 'not-a-status' }), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Valid status is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('allows n8n ingest auth to mark a run terminal and records an event', async () => {
    vi.stubEnv('N8N_INGEST_SECRET', 'n8n-secret')
    const update = vi.fn()
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'agent_runs') {
        return {
          update: (payload: Record<string, unknown>) => {
            update(payload)
            return {
              eq: () => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({ data: { id: 'run-1' }, error: null }),
                }),
              }),
            }
          },
        }
      }
      if (table === 'agent_run_events') return { insert }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await PATCH(
      patchRequest(
        { status: 'failed', error_message: 'Webhook returned 500' },
        'Bearer n8n-secret',
      ),
      params,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, run_id: 'run-1' })
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: 'Webhook returned 500',
      current_step: 'failed',
      completed_at: expect.any(String),
    }))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      run_id: 'run-1',
      event_type: 'run_status_updated',
      severity: 'error',
      message: 'Webhook returned 500',
      metadata: { status: 'failed' },
    }))
  })

  it('clears completed_at when moving a run back to running', async () => {
    const update = vi.fn()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'agent_runs') {
        return {
          update: (payload: Record<string, unknown>) => {
            update(payload)
            return {
              eq: () => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({ data: { id: 'run-1' }, error: null }),
                }),
              }),
            }
          },
        }
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })

    const response = await PATCH(patchRequest({ status: 'running', current_step: 'retry' }), params)

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'running',
      current_step: 'retry',
      completed_at: null,
    }))
  })
})
