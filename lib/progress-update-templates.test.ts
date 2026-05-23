import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  recordAgentStep: vi.fn(),
  startAgentRun: vi.fn(),
  supabaseEq: vi.fn(),
  supabaseFrom: vi.fn(),
  supabaseUpdate: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}))

vi.mock('./agent-run', () => ({
  attachAgentArtifact: mocks.attachAgentArtifact,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
  recordAgentStep: mocks.recordAgentStep,
  startAgentRun: mocks.startAgentRun,
}))

import {
  buildProgressUpdateAgentTracePayload,
  updateProgressUpdateLogStatus,
} from './progress-update-templates'

describe('progress update agent trace payloads', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null trace fields when no agent run exists', () => {
    expect(buildProgressUpdateAgentTracePayload(null)).toEqual({
      agent_run_id: null,
      agent_event_callback_url: null,
      agent_callback_contract: null,
      agent_trace: null,
    })
  })

  it('builds the generic Agent Ops callback envelope for n8n', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://portfolio.example.com/')

    expect(buildProgressUpdateAgentTracePayload('agent-run-1')).toMatchObject({
      agent_run_id: 'agent-run-1',
      agent_event_callback_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
      agent_callback_contract: {
        version: 1,
        runtime: 'n8n',
        events_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
        auth_header: 'Authorization: Bearer N8N_INGEST_SECRET',
        required_fields: ['workflow_id', 'stage', 'status'],
        final_completion_payload: {
          workflow_id: 'client-progress-update-router',
          status: 'completed',
          final: true,
        },
        failure_payload: {
          workflow_id: 'client-progress-update-router',
          status: 'failed',
        },
      },
      agent_trace: {
        version: 1,
        runtime: 'n8n',
        agent_run_id: 'agent-run-1',
        workflow_id: 'client-progress-update-router',
        events_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
        auth: 'Bearer N8N_INGEST_SECRET',
        callback_contract: {
          events_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
          auth_header: 'Authorization: Bearer N8N_INGEST_SECRET',
        },
      },
    })
  })
})

describe('updateProgressUpdateLogStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.supabaseFrom.mockReturnValue({ update: mocks.supabaseUpdate })
    mocks.supabaseUpdate.mockReturnValue({ eq: mocks.supabaseEq })
    mocks.supabaseEq.mockResolvedValue({ error: null })
    mocks.attachAgentArtifact.mockResolvedValue(undefined)
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.recordAgentStep.mockResolvedValue(undefined)
  })

  it('completes the Agent Ops run after n8n confirms delivery', async () => {
    const result = await updateProgressUpdateLogStatus(
      'log-1',
      'sent',
      undefined,
      'agent-run-1',
    )

    expect(result).toBe(true)
    expect(mocks.supabaseFrom).toHaveBeenCalledWith('progress_update_log')
    expect(mocks.supabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_status: 'sent',
        sent_at: expect.any(String),
      }),
    )
    expect(mocks.supabaseEq).toHaveBeenCalledWith('id', 'log-1')
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'delivery_callback_received',
        name: 'Progress update delivery confirmed',
        status: 'completed',
        outputSummary: 'Delivery status: sent',
        metadata: { log_id: 'log-1', delivery_status: 'sent' },
        idempotencyKey: 'agent-run-1:delivery:log-1:sent',
      }),
    )
    expect(mocks.attachAgentArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        artifactType: 'progress_update_delivery',
        refType: 'progress_update_log',
        refId: 'log-1',
        idempotencyKey: 'agent-run-1:artifact:log-1',
      }),
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith({
      runId: 'agent-run-1',
      status: 'completed',
      currentStep: 'Progress update delivered',
      outcome: { log_id: 'log-1', delivery_status: 'sent' },
    })
    expect(mocks.markAgentRunFailed).not.toHaveBeenCalled()
  })

  it('marks the Agent Ops run failed when n8n reports delivery failure', async () => {
    const result = await updateProgressUpdateLogStatus(
      'log-2',
      'failed',
      'Slack channel missing',
      'agent-run-2',
    )

    expect(result).toBe(true)
    expect(mocks.supabaseUpdate).toHaveBeenCalledWith({
      delivery_status: 'failed',
      error_message: 'Slack channel missing',
    })
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-2',
        name: 'Progress update delivery failed',
        status: 'failed',
        outputSummary: 'Slack channel missing',
        idempotencyKey: 'agent-run-2:delivery:log-2:failed',
      }),
    )
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-2',
      'Slack channel missing',
      {
        log_id: 'log-2',
        delivery_status: 'failed',
      },
    )
    expect(mocks.attachAgentArtifact).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('fails the Agent Ops run when the delivery log update is rejected', async () => {
    mocks.supabaseEq.mockResolvedValueOnce({
      error: { message: 'database timeout' },
    })

    const result = await updateProgressUpdateLogStatus(
      'log-3',
      'sent',
      undefined,
      'agent-run-3',
    )

    expect(result).toBe(false)
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-3',
      'Progress update delivery callback failed for log log-3',
      {
        log_id: 'log-3',
        delivery_status: 'sent',
        error_message: 'database timeout',
      },
    )
    expect(mocks.recordAgentStep).not.toHaveBeenCalled()
    expect(mocks.attachAgentArtifact).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })
})
