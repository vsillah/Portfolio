import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
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
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
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
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
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
    expect(mocks.markAgentRunFailed).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('normalizes n8n failure callbacks into failed steps, error events, and failed runs', async () => {
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
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'run-2',
      'LLM node timed out',
      expect.objectContaining({
        workflow_id: 'WF-SOC-001',
        stage: 'Generate draft',
        n8n_status: 'error',
        error_message: 'LLM node timed out',
      }),
    )
  })

  it('normalizes final n8n completion callbacks into completion events and completed runs', async () => {
    const response = await POST(makeRequest({
      workflow_id: 'WF-VEP-002',
      stage: 'Write summary artifact',
      status: 'success',
      items_count: 3,
      final: true,
    }) as never, { params: { runId: 'run-3' } })

    expect(response.status).toBe(200)
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-3',
      eventType: 'n8n_completion',
      severity: 'info',
      message: 'Write summary artifact',
      metadata: expect.objectContaining({
        workflow_id: 'WF-VEP-002',
        stage: 'Write summary artifact',
        n8n_status: 'success',
        items_count: 3,
        final: true,
      }),
    }))
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-3',
      stepKey: 'n8n_wf_vep_002_write_summary_artifact',
      name: 'Write summary artifact',
      status: 'completed',
      outputSummary: '3 item(s)',
    }))
    expect(mocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-3',
      status: 'completed',
      currentStep: 'Write summary artifact',
      outcome: expect.objectContaining({
        workflow_id: 'WF-VEP-002',
        stage: 'Write summary artifact',
        final: true,
      }),
    }))
    expect(mocks.markAgentRunFailed).not.toHaveBeenCalled()
  })

  it('closes provisioning reminder traces when WF-PROV sends its final callback', async () => {
    const response = await POST(makeRequest({
      workflow_id: 'WF-PROV',
      stage: 'provisioning_reminder_sent',
      status: 'completed',
      final: true,
      items_count: 1,
      metadata: {
        delivery_channel: 'email',
        project_name: 'Automation Sprint',
      },
      idempotency_key: 'run-4:WF-PROV:provisioning_reminder_sent',
    }) as never, { params: { runId: 'run-4' } })

    expect(response.status).toBe(200)
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-4',
      eventType: 'n8n_completion',
      message: 'provisioning_reminder_sent',
      metadata: expect.objectContaining({
        workflow_id: 'WF-PROV',
        stage: 'provisioning_reminder_sent',
        n8n_status: 'completed',
        final: true,
        delivery_channel: 'email',
        project_name: 'Automation Sprint',
      }),
      idempotencyKey: 'run-4:WF-PROV:provisioning_reminder_sent',
    }))
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-4',
      stepKey: 'n8n_wf_prov_provisioning_reminder_sent',
      status: 'completed',
      outputSummary: '1 item(s)',
      idempotencyKey: 'run-4:WF-PROV:provisioning_reminder_sent:step',
    }))
    expect(mocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-4',
      status: 'completed',
      currentStep: 'provisioning_reminder_sent',
      outcome: expect.objectContaining({
        workflow_id: 'WF-PROV',
        stage: 'provisioning_reminder_sent',
        final: true,
        delivery_channel: 'email',
      }),
    }))
  })

  it('records progress update delivery trace stages without closing the run early', async () => {
    const response = await POST(makeRequest({
      workflow_id: 'client-progress-update-router',
      stage: 'slack_delivery_complete',
      status: 'completed',
      items_count: 1,
      metadata: {
        channel: 'slack',
        delivery_status: 'sent',
      },
      idempotency_key: 'run-5:client-progress-update-router:slack_delivery_complete',
    }) as never, { params: { runId: 'run-5' } })

    expect(response.status).toBe(200)
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-5',
      stepKey: 'n8n_client_progress_update_router_slack_delivery_complete',
      name: 'slack_delivery_complete',
      status: 'completed',
      outputSummary: '1 item(s)',
      metadata: expect.objectContaining({
        workflow_id: 'client-progress-update-router',
        stage: 'slack_delivery_complete',
        channel: 'slack',
        delivery_status: 'sent',
      }),
    }))
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
    expect(mocks.markAgentRunFailed).not.toHaveBeenCalled()
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
