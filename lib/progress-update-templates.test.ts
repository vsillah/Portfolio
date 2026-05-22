import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: {},
}))

vi.mock('./agent-run', () => ({
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  recordAgentStep: vi.fn(),
  startAgentRun: vi.fn(),
}))

import { buildProgressUpdateAgentTracePayload } from './progress-update-templates'

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
