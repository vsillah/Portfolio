import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  markAgentRunFailed: vi.fn(),
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

vi.mock('@/lib/agent-run', () => ({
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

import { GET, PATCH } from './route'

function makeBuilder(result: {
  data?: unknown
  error?: { message: string } | null
  singleData?: unknown
}) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: result.singleData ?? result.data ?? null, error: result.error ?? null }),
    then: undefined,
  }
}

function makeGetBuilder(result: { data: unknown; error?: { message: string } | null }) {
  const builder = makeBuilder(result)
  builder.limit = vi.fn().mockResolvedValue({ data: result.data, error: result.error ?? null }) as never
  return builder
}

function makeRequest(url = 'http://localhost/api/admin/video-generation/workflow-status') {
  return new Request(url, { headers: { authorization: 'Bearer token' } })
}

function makePatchRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/video-generation/workflow-status', {
    method: 'PATCH',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/video-generation/workflow-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
  })

  it('returns agent_run_id for video generation workflow runs', async () => {
    const builder = makeGetBuilder({
      data: [{
        id: 'video-run-1',
        workflow_id: 'vgen_heygen',
        agent_run_id: 'agent-run-1',
        triggered_at: new Date().toISOString(),
        completed_at: null,
        status: 'running',
        stages: {},
        items_inserted: null,
        error_message: null,
        summary: 'HeyGen catalog',
      }],
    })
    mocks.from.mockReturnValue(builder)

    const response = await GET(makeRequest() as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      runs: [expect.objectContaining({
        id: 'video-run-1',
        workflow_id: 'vgen_heygen',
        agent_run_id: 'agent-run-1',
      })],
    })
  })

  it('marks the linked Agent Ops run failed when a running legacy run is cancelled', async () => {
    const fetchBuilder = makeBuilder({
      singleData: {
        id: 'video-run-1',
        workflow_id: 'vgen_drive',
        agent_run_id: 'agent-run-1',
        status: 'running',
      },
    })
    const updateBuilder = makeBuilder({ data: null, error: null })
    updateBuilder.eq = vi.fn().mockResolvedValue({ error: null }) as never
    mocks.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder)

    const response = await PATCH(makePatchRequest({
      run_id: 'video-run-1',
      reason: 'Stale run cleanup',
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'video-run-1',
      agent_run_id: 'agent-run-1',
    })
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-1',
      'Stale run cleanup',
      expect.objectContaining({
        workflow_id: 'vgen_drive',
        legacy_run_id: 'video-run-1',
      }),
    )
  })
})
