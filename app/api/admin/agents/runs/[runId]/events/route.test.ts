import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  recordAgentEvent: vi.fn(),
  recordAgentStep: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-run', () => ({
  AGENT_EVENT_SEVERITIES: ['debug', 'info', 'warning', 'error'],
  AGENT_RUN_STATUSES: ['queued', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled', 'stale'],
  recordAgentEvent: mocks.recordAgentEvent,
  recordAgentStep: mocks.recordAgentStep,
}))

import { POST } from './route'

function makeRequest(body: unknown, token = 'test-n8n-secret') {
  return new Request('http://localhost/api/admin/agents/runs/run-1/events', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/runs/[runId]/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.N8N_INGEST_SECRET = 'test-n8n-secret'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
  })

  it('lets n8n report a stage as both an event and a run step', async () => {
    const response = await POST(makeRequest({
      workflow_id: 'WF-WRM-001',
      stage: 'Scrape LinkedIn connections',
      status: 'running',
      items_count: 12,
      metadata: { source: 'linkedin' },
      idempotency_key: 'n8n-run-1:linkedin:scrape',
    }) as never, { params: { runId: 'run-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, event_id: 'event-1', step_id: 'step-1' })
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      eventType: 'n8n_progress',
      severity: 'info',
      message: 'Scrape LinkedIn connections',
      metadata: expect.objectContaining({
        source: 'linkedin',
        workflow_id: 'WF-WRM-001',
        stage: 'Scrape LinkedIn connections',
        n8n_status: 'running',
        items_count: 12,
      }),
      idempotencyKey: 'n8n-run-1:linkedin:scrape',
    }))
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      stepKey: 'n8n_wf_wrm_001_scrape_linkedin_connections',
      name: 'Scrape LinkedIn connections',
      status: 'running',
      outputSummary: '12 item(s)',
      idempotencyKey: 'n8n-run-1:linkedin:scrape:step',
    }))
  })

  it('normalizes n8n failure callbacks into failed steps and error events', async () => {
    const response = await POST(makeRequest({
      workflow_id: 'WF-SOC-001',
      stage: 'Generate draft',
      status: 'error',
      error_message: 'LLM node timed out',
    }) as never, { params: { runId: 'run-2' } })

    expect(response.status).toBe(200)
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-2',
      eventType: 'n8n_failure',
      severity: 'error',
      message: 'LLM node timed out',
    }))
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-2',
      status: 'failed',
      outputSummary: 'LLM node timed out',
    }))
  })

  it('rejects invalid n8n bearer tokens when the request is not from an admin', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({
      stage: 'Attempted callback',
      status: 'running',
    }, 'wrong-secret') as never, { params: { runId: 'run-1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.verifyAdmin).toHaveBeenCalledTimes(1)
    expect(mocks.recordAgentEvent).not.toHaveBeenCalled()
    expect(mocks.recordAgentStep).not.toHaveBeenCalled()
  })

  it('allows admin-authenticated event writes when no n8n bearer token matches', async () => {
    const response = await POST(makeRequest({
      event_type: 'manual_note',
      severity: 'warning',
      message: 'Admin added context after reviewing the trace.',
    }, 'wrong-secret') as never, { params: { runId: 'run-1' } })

    expect(response.status).toBe(200)
    expect(mocks.verifyAdmin).toHaveBeenCalledTimes(1)
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      eventType: 'manual_note',
      severity: 'warning',
      message: 'Admin added context after reviewing the trace.',
    }))
    expect(mocks.recordAgentStep).not.toHaveBeenCalled()
  })

  it('rejects malformed callback statuses', async () => {
    const response = await POST(makeRequest({
      stage: 'Unknown stage',
      status: 'almost_done',
    }) as never, { params: { runId: 'run-1' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid callback status: almost_done' })
    expect(mocks.recordAgentEvent).not.toHaveBeenCalled()
    expect(mocks.recordAgentStep).not.toHaveBeenCalled()
  })
})
