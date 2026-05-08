import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  createAgentRunRecoveryRequest: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-run-recovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agent-run-recovery')>()
  return {
    ...actual,
    createAgentRunRecoveryRequest: mocks.createAgentRunRecoveryRequest,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function makeRequest(body: unknown = {}) {
  return new Request('http://localhost/api/admin/agents/runs/source-run-1/retry', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function sourceRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'source-run-1',
    agent_key: 'automation-systems',
    runtime: 'n8n',
    kind: 'warm_lead_scrape',
    title: 'Warm lead scrape',
    status: 'failed',
    subject_type: 'workflow',
    subject_id: 'WF-WRM-003',
    subject_label: 'LinkedIn Warm Lead Scraper',
    current_step: 'Normalize webhook payload',
    error_message: 'Webhook returned 500.',
    metadata: {},
    ...overrides,
  }
}

function sourceRunQuery(data = sourceRun(), error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
}

function recoveryQuery(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    contains: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

describe('POST /api/admin/agents/runs/[runId]/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createAgentRunRecoveryRequest.mockResolvedValue({
      runId: 'recovery-run-1',
      recoveryPacketAttached: true,
      plan: {
        retry_attempt: 2,
        earliest_retry_at: '2026-05-07T12:15:00.000Z',
        target_agent_key: 'automation-systems',
        target_agent_name: 'Automation Systems Agent',
        execution_mode: 'read_only_recovery_request',
      },
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest() as never, { params: { runId: 'source-run-1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a read-only recovery request for a failed run', async () => {
    mocks.from
      .mockReturnValueOnce(sourceRunQuery(sourceRun()))
      .mockReturnValueOnce(recoveryQuery([
        {
          id: 'prior-recovery',
          status: 'completed',
          metadata: {
            source_run_id: 'source-run-1',
            retry_attempt: 1,
            earliest_retry_at: '2026-05-07T11:00:00.000Z',
          },
        },
      ]))

    const response = await POST(makeRequest({ note: 'Retry after payload check.' }) as never, {
      params: { runId: 'source-run-1' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'recovery-run-1',
      source_run_id: 'source-run-1',
      retry_attempt: 2,
      earliest_retry_at: '2026-05-07T12:15:00.000Z',
      target_agent_key: 'automation-systems',
      target_agent_name: 'Automation Systems Agent',
      recovery_packet_attached: true,
      execution_mode: 'read_only_recovery_request',
    })
    expect(mocks.createAgentRunRecoveryRequest).toHaveBeenCalledWith(expect.objectContaining({
      previousRecoveryCount: 1,
      actor: expect.objectContaining({
        subjectType: 'agent_run',
        subjectId: 'source-run-1',
        userId: 'admin-user',
      }),
      note: 'Retry after payload check.',
    }))
  })

  it('blocks duplicate recovery requests while a prior backoff window is active', async () => {
    mocks.from
      .mockReturnValueOnce(sourceRunQuery(sourceRun()))
      .mockReturnValueOnce(recoveryQuery([
        {
          id: 'recovery-run-1',
          status: 'completed',
          metadata: {
            source_run_id: 'source-run-1',
            retry_attempt: 1,
            earliest_retry_at: '2999-05-07T12:15:00.000Z',
          },
        },
      ]))

    const response = await POST(makeRequest({ note: 'Retry again.' }) as never, {
      params: { runId: 'source-run-1' },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      ok: false,
      error: 'A recovery request is already waiting for its backoff window.',
      source_run_id: 'source-run-1',
      recovery_run_id: 'recovery-run-1',
      retry_attempt: 1,
      earliest_retry_at: '2999-05-07T12:15:00.000Z',
    })
    expect(mocks.createAgentRunRecoveryRequest).not.toHaveBeenCalled()
  })

  it('rejects non-recoverable active runs', async () => {
    mocks.from.mockReturnValueOnce(sourceRunQuery(sourceRun({ status: 'running' })))

    const response = await POST(makeRequest() as never, { params: { runId: 'source-run-1' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Only failed, stale, or cancelled runs can be queued for recovery',
    })
    expect(mocks.createAgentRunRecoveryRequest).not.toHaveBeenCalled()
  })
})
